import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { getPresetsJvmOptions } from './presets.js';

/**
 * Configuration options for modifying the Docker Compose file.
 * 
 * @typedef {Object} ComposeModifierOptions
 * @property {string[]} presets - Array of preset names to apply (e.g., ['localstack'])
 * @property {string} additionalJvmOptions - Additional JVM options as a string (line-separated key=value pairs)
 * @property {number} [mbytes=5] - Minimum part size in megabytes for S3 uploads
 * @property {string} [serviceName='dataverse'] - Name of the service to modify in compose file
 */

/**
 * Parses line-separated JVM options into an array of formatted JVM arguments.
 * 
 * This function takes a string containing line-separated JVM options in the format
 * "key=value" or "-Dkey=value" and converts them into properly formatted JVM system
 * property arguments. Empty lines and whitespace are handled gracefully.
 * 
 * @param {string} jvmOptionsString - Line-separated JVM options string
 * @returns {string[]} Array of formatted JVM option strings (e.g., ["-Dkey=value"])
 */
export function parseJvmOptions(jvmOptionsString) {
    if (!jvmOptionsString || typeof jvmOptionsString !== 'string') {
        return [];
    }

    return jvmOptionsString
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
            // If the line doesn't start with -D, add it
            if (!line.startsWith('-D')) {
                return `-D${line}`;
            }
            return line;
        });
}

/**
 * Merges JVM options into existing JVM_ARGS environment variable value.
 * 
 * This function takes the current JVM_ARGS string and an array of new JVM options,
 * and combines them intelligently. It preserves the existing options and appends
 * new ones, ensuring proper spacing between arguments.
 * 
 * @param {string} currentJvmArgs - Current value of JVM_ARGS environment variable
 * @param {string[]} newJvmOptions - Array of new JVM options to append
 * @returns {string} Combined JVM_ARGS string with all options
 */
export function mergeJvmArgs(currentJvmArgs, newJvmOptions) {
    if (!newJvmOptions || newJvmOptions.length === 0) {
        return currentJvmArgs;
    }

    const newArgsString = newJvmOptions.join(' ');

    if (!currentJvmArgs || currentJvmArgs.trim().length === 0) {
        return newArgsString;
    }

    // Ensure there's a space between existing and new options
    return `${currentJvmArgs.trimEnd()} ${newArgsString}`;
}

/**
 * Modifies the Docker Compose configuration to include JVM options from presets and custom inputs.
 * 
 * This function performs the following operations:
 * 1. Parses the input Docker Compose YAML file
 * 2. Validates that required presets exist
 * 3. Generates JVM options from selected presets
 * 4. Merges preset JVM options with any additional custom JVM options
 * 5. Updates the JVM_ARGS environment variable in the specified service
 * 6. Writes the modified configuration to a new file with "modified-" prefix
 * 
 * The function ensures that the YAML structure and formatting are preserved while
 * making targeted modifications to the environment configuration.
 * 
 * @param {string} composeFilePath - Path to the original docker-compose.yml file
 * @param {ComposeModifierOptions} options - Configuration options for modification
 * @returns {string} Path to the newly created modified compose file
 * @throws {Error} When the compose file cannot be read, parsed, or written
 * @throws {Error} When a specified preset is not found in the registry
 * @throws {Error} When the specified service is not found in the compose file
 */
export function modifyComposeFile(composeFilePath, options) {
    const {
        presets = [],
        additionalJvmOptions = '',
        mbytes = 5,
        serviceName = 'dataverse'
    } = options;

    // Read and parse the compose file
    const composeContent = fs.readFileSync(composeFilePath, 'utf8');
    const composeConfig = yaml.load(composeContent);

    // Validate that the service exists
    if (!composeConfig.services || !composeConfig.services[serviceName]) {
        throw new Error(
            `Service '${serviceName}' not found in compose file. ` +
            `Available services: ${Object.keys(composeConfig.services || {}).join(', ')}`
        );
    }

    // Collect all JVM options
    const allJvmOptions = [];

    // Add preset JVM options
    if (presets.length > 0) {
        const presetJvmOptions = getPresetsJvmOptions(presets, { mbytes });
        allJvmOptions.push(...presetJvmOptions);
    }

    // Add additional custom JVM options
    const customJvmOptions = parseJvmOptions(additionalJvmOptions);
    allJvmOptions.push(...customJvmOptions);

    // Modify the compose configuration
    if (allJvmOptions.length > 0) {
        const service = composeConfig.services[serviceName];

        // Ensure environment section exists
        if (!service.environment) {
            service.environment = {};
        }

        // Get current JVM_ARGS value
        const currentJvmArgs = service.environment.JVM_ARGS || '';

        // Merge new options with existing ones
        service.environment.JVM_ARGS = mergeJvmArgs(currentJvmArgs, allJvmOptions);
    }

    // Generate output file path
    const dirname = path.dirname(composeFilePath);
    const basename = path.basename(composeFilePath);
    const outputFilePath = path.join(dirname, `modified-${basename}`);

    // Write the modified compose file
    const modifiedContent = yaml.dump(composeConfig, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
        noRefs: true,  // Don't use anchors/aliases
        sortKeys: false // Preserve key order
    });

    fs.writeFileSync(outputFilePath, modifiedContent, 'utf8');

    return outputFilePath;
}

