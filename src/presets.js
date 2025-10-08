/**
 * Generates JVM options for configuring LocalStack S3 storage driver in Dataverse.
 * 
 * This function creates the necessary JVM system properties to configure a LocalStack
 * S3 storage driver for Dataverse. LocalStack is used as a local AWS cloud stack
 * emulator for testing and development purposes.
 * 
 * @param {number} mbytes - The minimum part size for multipart uploads in megabytes.
 *                         Must be at least 5MB as per AWS S3 requirements.
 * @returns {string[]} Array of JVM system property strings for LocalStack configuration
 * @throws {Error} When mbytes is less than 5
 */
export function localStackPreset(mbytes) {
    if (mbytes < 5) {
        throw new Error("Min part size must be at least 5MB");
    }

    const minPartSize = mbytes * 1024 * 1024;
    return [
        "-Ddataverse.files.localstack1.type=s3",
        "-Ddataverse.files.localstack1.label=LocalStack",
        "-Ddataverse.files.localstack1.custom-endpoint-url=http://localstack:4566",
        "-Ddataverse.files.localstack1.custom-endpoint-region=us-east-2",
        "-Ddataverse.files.localstack1.bucket-name=mybucket",
        "-Ddataverse.files.localstack1.path-style-access=true",
        "-Ddataverse.files.localstack1.upload-redirect=true",
        "-Ddataverse.files.localstack1.download-redirect=true",
        "-Ddataverse.files.localstack1.access-key=default",
        "-Ddataverse.files.localstack1.secret-key=default",
        `-Ddataverse.files.localstack1.min-part-size=${minPartSize}`,
    ]
}

/**
 * Registry of available presets. Each preset is a function that returns an array of JVM options.
 * Presets can accept configuration parameters as needed.
 */
export const PRESET_REGISTRY = {
    localstack: localStackPreset
};

/**
 * Gets JVM options for the specified preset names with provided options.
 * 
 * This function validates that all requested presets exist in the registry and
 * generates the corresponding JVM configuration options by invoking each preset
 * function with the provided options object.
 * 
 * @param {string[]} presetNames - Array of preset names to apply (e.g., ['localstack'])
 * @param {Object} options - Configuration options to pass to preset functions
 * @param {number} [options.mbytes=5] - Minimum part size in megabytes for S3 uploads
 * @returns {string[]} Combined array of JVM system property strings from all presets
 * @throws {Error} When a requested preset is not found in the registry
 */
export function getPresetsJvmOptions(presetNames, options = {}) {
    const defaultOptions = {
        mbytes: 5,
        ...options
    };

    const allJvmOptions = [];

    for (const presetName of presetNames) {
        const presetFunction = PRESET_REGISTRY[presetName];

        if (!presetFunction) {
            const availablePresets = Object.keys(PRESET_REGISTRY).join(', ');
            throw new Error(
                `Preset '${presetName}' is not defined. Available presets: ${availablePresets}`
            );
        }

        const jvmOptions = presetFunction(defaultOptions.mbytes);
        allJvmOptions.push(...jvmOptions);
    }

    return allJvmOptions;
}