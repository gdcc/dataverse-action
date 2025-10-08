import core from '@actions/core';
import exec from '@actions/exec';
import fs from 'fs';
import path from 'path';
import { modifyComposeFile } from './composeModifier.js';
import { getBaseComposeFilePath, getDefaultProjectName } from './utils.js';

/**
 * Configuration object for the action
 * @typedef {Object} ActionConfig
 * @property {string} imageTag - Docker image tag to use
 * @property {string} imageDataverse - Dataverse image name
 * @property {string} imageConfigbaker - Configbaker image name
 * @property {string} postgresqlVersion - PostgreSQL version override
 * @property {string} solrVersion - Solr version override
 * @property {string} jvmOptions - JVM configuration options
 * @property {string[]} presets - Array of preset names to apply
 * @property {number} minPartSizeMb - Minimum part size for multipart uploads in MB
 */

/**
 * Main entry point for the action
 */
async function run() {
    try {
        const config = getActionInputs();

        await pullDockerImages(config);
        const versions = await resolveDependencyVersions(config);
        await setupEnvironment(config, versions);

        // Modify compose file with presets and custom JVM options
        const baseComposeFile = getBaseComposeFilePath();
        const modifiedComposeFile = await modifyComposeWithJvmOptions(config, baseComposeFile);

        const composeConfig = await startDataverseStack(modifiedComposeFile);
        await bootstrapDataverse(config, composeConfig);
        await setActionOutputs();

    } catch (error) {
        core.setFailed(error.message);
    }
}

/**
 * Retrieves and validates action inputs
 * @returns {ActionConfig} Configuration object
 */
function getActionInputs() {
    // Parse presets from comma-separated or line-separated string
    const presetsInput = core.getInput('presets') || '';
    const presets = presetsInput
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    // Parse minimum part size with default value
    const minPartSizeInput = core.getInput('min_part_size_mb');
    const minPartSizeMb = minPartSizeInput ? parseInt(minPartSizeInput, 10) : 5;

    return {
        imageTag: core.getInput('image_tag', { required: true }),
        imageDataverse: core.getInput('image_dataverse', { required: true }),
        imageConfigbaker: core.getInput('image_configbaker', { required: true }),
        postgresqlVersion: core.getInput('postgresql_version'),
        solrVersion: core.getInput('solr_version'),
        jvmOptions: core.getInput('jvm_options') || '',
        presets,
        minPartSizeMb
    };
}

/**
 * Pulls required Docker images for caching and inspection
 * @param {ActionConfig} config - Action configuration
 */
async function pullDockerImages(config) {
    core.info('Pulling Docker images...');
    await exec.exec('docker', ['pull', '-q', `${config.imageDataverse}:${config.imageTag}`]);
    await exec.exec('docker', ['pull', '-q', `${config.imageConfigbaker}:${config.imageTag}`]);
}

/**
 * Resolves PostgreSQL and Solr versions from inputs or image labels
 * @param {ActionConfig} config - Action configuration
 * @returns {Promise<{pgVersion: string, solrVersion: string}>} Resolved versions
 */
async function resolveDependencyVersions(config) {
    const pgVersion = await resolveImageLabelOrInput(
        config.postgresqlVersion,
        `${config.imageDataverse}:${config.imageTag}`,
        'org.dataverse.deps.postgresql.version'
    );

    const solrVersion = await resolveImageLabelOrInput(
        config.solrVersion,
        `${config.imageDataverse}:${config.imageTag}`,
        'org.dataverse.deps.solr.version'
    );

    if (!pgVersion) throw new Error('Cannot find PostgreSQL version');
    if (!solrVersion) throw new Error('Cannot find Solr version');

    return { pgVersion, solrVersion };
}

/**
 * Sets up environment variables for Docker Compose
 * @param {ActionConfig} config - Action configuration
 * @param {Object} versions - Resolved dependency versions
 */
async function setupEnvironment(config, versions) {
    core.info('Setting up environment variables...');

    core.exportVariable('POSTGRES_VERSION', versions.pgVersion);
    core.exportVariable('SOLR_VERSION', versions.solrVersion);
    core.exportVariable('CONFIGBAKER_IMAGE', `${config.imageConfigbaker}:${config.imageTag}`);
    core.exportVariable('DATAVERSE_IMAGE', `${config.imageDataverse}:${config.imageTag}`);
    core.exportVariable('DATAVERSE_DB_USER', 'dataverse');
    core.exportVariable('DATAVERSE_DB_PASSWORD', 'secret');
}

/**
 * Modifies the compose file with JVM options from presets and custom inputs.
 * 
 * This function uses the composeModifier module to properly parse the YAML
 * configuration, apply preset JVM options and custom JVM options, and generate
 * a new compose file.
 * 
 * @param {ActionConfig} config - Action configuration
 * @param {string} composeFile - Path to the original compose file
 * @returns {Promise<string>} Path to the modified compose file
 */
async function modifyComposeWithJvmOptions(config, composeFile) {
    core.info('Modifying compose file with JVM options...');

    try {
        const modifiedPath = modifyComposeFile(composeFile, {
            presets: config.presets,
            additionalJvmOptions: config.jvmOptions,
            mbytes: config.minPartSizeMb,
            serviceName: 'dataverse'
        });

        core.info(`Created modified compose file: ${modifiedPath}`);
        return modifiedPath;
    } catch (error) {
        core.error(`Failed to modify compose file: ${error.message}`);
        throw error;
    }
}

/**
 * Starts the Dataverse Docker Compose stack using the provided compose file.
 * 
 * This function takes the compose file path (which should be the modified version
 * if presets were applied) and starts the Docker Compose stack. It saves the compose
 * file path and project name to GitHub Actions state so they can be retrieved during
 * the post-run cleanup phase.
 * 
 * @param {string} composeFilePath - Path to the compose file to use (modified or base)
 * @returns {Promise<{composeFile: string, projectName: string}>} Compose configuration
 */
async function startDataverseStack(composeFilePath) {
    const composeFile = composeFilePath;
    const projectName = getDefaultProjectName();

    // Save state for post-run cleanup - this ensures post.js uses the same files
    core.saveState('compose_file', composeFile);
    core.saveState('compose_project', projectName);

    // Create directory structure before Docker Compose starts to ensure correct permissions
    // This prevents Docker from creating directories as root which would cause permission issues
    const runnerTemp = process.env.RUNNER_TEMP || path.join(process.cwd(), 'tmp');
    const dvDir = path.join(runnerTemp, 'dv');
    const dvDataDir = path.join(dvDir, 'data');
    const dvConfLocalstackDir = path.join(dvDir, 'conf', 'localstack');
    const solrDataDir = path.join(runnerTemp, 'solr', 'data');
    const solrConfDir = path.join(runnerTemp, 'solr', 'conf');

    fs.mkdirSync(dvDataDir, { recursive: true });
    fs.mkdirSync(dvConfLocalstackDir, { recursive: true });
    fs.mkdirSync(solrDataDir, { recursive: true });
    fs.mkdirSync(solrConfDir, { recursive: true });

    // Copy localstack initialization scripts from workspace to temp directory
    const workspaceLocalstackDir = path.join(process.cwd(), 'dv', 'conf', 'localstack');
    if (fs.existsSync(workspaceLocalstackDir)) {
        const files = fs.readdirSync(workspaceLocalstackDir);
        for (const file of files) {
            const srcPath = path.join(workspaceLocalstackDir, file);
            const destPath = path.join(dvConfLocalstackDir, file);
            fs.copyFileSync(srcPath, destPath);
            // Ensure scripts are executable
            fs.chmodSync(destPath, 0o755);
        }
        core.info(`Copied ${files.length} localstack initialization script(s)`);
    }

    core.info(`Created volume mount directories under: ${runnerTemp}`);

    core.startGroup('🥎 Start Dataverse service in background');
    await exec.exec('docker', ['compose', '-f', composeFile, '-p', projectName, 'up', '-d', '--quiet-pull']);
    core.endGroup();

    return { composeFile, projectName };
}

/**
 * Bootstraps the Dataverse instance using Configbaker
 * @param {ActionConfig} config - Action configuration
 * @param {Object} composeConfig - Docker Compose configuration
 */
async function bootstrapDataverse(config, composeConfig) {
    core.startGroup('🤖 Bootstrap Dataverse service');

    const runnerTemp = process.env.RUNNER_TEMP || path.join(process.cwd(), 'tmp');
    const dvDir = path.join(runnerTemp, 'dv');
    const exposeEnv = path.join(dvDir, 'bootstrap.exposed.env');

    // Create the bootstrap environment file (directory already exists from startDataverseStack)
    fs.closeSync(fs.openSync(exposeEnv, 'w'));
    fs.chmodSync(exposeEnv, 0o666);

    core.info(`Bootstrap environment file created at: ${exposeEnv}`);

    const networkName = `${composeConfig.projectName}_dataverse`;
    await exec.exec('docker', [
        'run', '-i', '--network', networkName,
        '-v', `${exposeEnv}:/.env`,
        `${config.imageConfigbaker}:${config.imageTag}`,
        'bootstrap.sh', '-e', '/.env', 'dev'
    ]);

    core.endGroup();
}

/**
 * Sets action outputs from bootstrap results and API calls
 */
async function setActionOutputs() {
    const runnerTemp = process.env.RUNNER_TEMP || path.join(process.cwd(), 'tmp');
    const exposeEnv = path.join(runnerTemp, 'dv', 'bootstrap.exposed.env');

    // Read API token from bootstrap output
    const envContent = fs.readFileSync(exposeEnv, 'utf8');
    const apiTokenMatch = envContent.match(/^API_TOKEN=(.*)$/m);
    if (apiTokenMatch) {
        core.setOutput('api_token', apiTokenMatch[1]);
    }

    core.setOutput('base_url', 'http://localhost:8080/');

    // Query Dataverse version from API
    const dvVersion = await getDataverseVersion();
    if (dvVersion) {
        core.setOutput('dv_version', dvVersion);
    }
}

/**
 * Queries the Dataverse API for version information
 * @returns {Promise<string>} Dataverse version or empty string if unavailable
 */
async function getDataverseVersion() {
    try {
        let output = '';
        await exec.exec('bash', ['-c', "curl -s 'http://localhost:8080/api/info/version' | jq -r '.data.version'"], {
            listeners: {
                stdout: (data) => { output += data.toString(); }
            }
        });
        return output.trim();
    } catch (error) {
        core.warning(`Could not retrieve Dataverse version: ${error.message}`);
        return '';
    }
}

/**
 * Resolves a version from input parameter or Docker image label
 * @param {string} inputValue - Input parameter value
 * @param {string} imageRef - Docker image reference
 * @param {string} labelKey - Docker label key to inspect
 * @returns {Promise<string>} Resolved version or empty string
 */
async function resolveImageLabelOrInput(inputValue, imageRef, labelKey) {
    if (inputValue) return inputValue;

    let output = '';
    try {
        await exec.exec('docker', ['inspect', '-f', `{{ index .Config.Labels "${labelKey}"}}`, imageRef], {
            listeners: {
                stdout: (data) => { output += data.toString(); }
            }
        });
        return output.trim();
    } catch (error) {
        core.debug(`Could not inspect image label ${labelKey}: ${error.message}`);
        return '';
    }
}

run();