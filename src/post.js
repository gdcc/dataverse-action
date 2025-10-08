import core from '@actions/core';
import exec from '@actions/exec';
import fs from 'fs';
import path from 'path';
import artifact from '@actions/artifact';
import { getActiveComposeFilePath, getDefaultProjectName, ensureDirectories } from './utils.js';

/**
 * Post-run configuration
 * @typedef {Object} PostConfig
 * @property {string} composeFile - Path to docker-compose.yml file
 * @property {string} projectName - Docker Compose project name
 */

/**
 * Main post-run cleanup function
 */
async function run() {
    const config = getPostRunConfig();

    try {
        await collectAndUploadLogs(config);
    } catch (error) {
        core.warning(`Log collection failed: ${error.message}`);
    }

    try {
        await cleanupDockerStack(config);
    } catch (error) {
        core.warning(`Stack cleanup failed: ${error.message}`);
    }
}

/**
 * Retrieves post-run configuration from saved state.
 * 
 * This function retrieves the compose file path and project name that were saved
 * during the main action run. If presets were applied, the compose file will be
 * the modified version. If the state wasn't saved (e.g., early failure), it falls
 * back to finding the active compose file (modified if exists, base otherwise).
 * 
 * @returns {PostConfig} Post-run configuration
 */
function getPostRunConfig() {
    // Try to get the saved state first (this will be the modified file if presets were used)
    const composeFile = core.getState('compose_file') || getActiveComposeFilePath();
    const projectName = core.getState('compose_project') || getDefaultProjectName();

    core.info(`Using compose file: ${composeFile}`);
    core.info(`Using project name: ${projectName}`);

    return { composeFile, projectName };
}

/**
 * Collects Dataverse logs and uploads them as artifacts
 * @param {PostConfig} config - Post-run configuration
 */
async function collectAndUploadLogs(config) {
    core.startGroup('📦 Collect and upload Dataverse logs');

    core.info(`Collecting logs for config: ${JSON.stringify(config)}`);

    // Include localstack as an additional service for log collection
    const artifactsDir = createArtifactsDirectory();
    const logFiles = await collectDataverseLogs(config, artifactsDir, ['localstack']);

    if (logFiles.length > 0) {
        core.info(`Uploading ${logFiles.length} log files`);
        await uploadLogArtifacts(logFiles, artifactsDir);
    }

    core.endGroup();
}

/**
 * Creates the artifacts directory for log collection
 * @returns {string} Path to artifacts directory
 */
function createArtifactsDirectory() {
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    ensureDirectories(artifactsDir);
    return artifactsDir;
}

/**
 * Collects logs from Docker Compose services
 * @param {PostConfig} config - Post-run configuration
 * @param {string} artifactsDir - Directory to store artifacts
 * @param {string[]} additionalServices - Additional services beyond core services
 * @returns {Promise<string[]>} Paths to the collected log files
 */
async function collectDataverseLogs(config, artifactsDir, additionalServices = []) {
    const coreServices = ['dataverse', 'postgres', 'solr', 'smtp'];
    const services = [...coreServices, ...additionalServices];

    core.info('Collecting logs via Docker Compose...');
    const logFiles = [];

    // Collect logs from all services
    for (const service of services) {
        const logFileName = service === 'dataverse' ? 'dataverse-server.log' : `${service}.log`;
        const logFile = path.join(artifactsDir, logFileName);
        logFiles.push(logFile);
        await collectComposeServiceLogs(config, logFile, service);
    }

    // Copy the compose file to artifacts for debugging
    const composeFile = path.join(artifactsDir, 'docker-compose.yml');
    if (fs.existsSync(config.composeFile)) {
        fs.copyFileSync(config.composeFile, composeFile);
        logFiles.push(composeFile);
    }

    return logFiles;
}

/**
 * Collects logs from a specific Docker Compose service
 * @param {PostConfig} config - Post-run configuration
 * @param {string} logFile - Path where to save the log file
 * @param {string} serviceName - Name of the service to collect logs from
 */
async function collectComposeServiceLogs(config, logFile, serviceName) {
    try {
        let output = '';
        await exec.exec('docker', ['compose', '-f', config.composeFile, '-p', config.projectName, 'logs', '--no-color', serviceName], {
            listeners: {
                stdout: (data) => { output += data.toString(); }
            }
        });

        if (output) {
            fs.writeFileSync(logFile, output, 'utf8');
            core.info('✅ Collected logs via Docker Compose');
        } else {
            core.warning(`No logs collected from ${serviceName} service`);
        }
    } catch (error) {
        core.debug(`Could not collect compose logs: ${error.message}`);
        fs.writeFileSync(logFile, `Log collection failed: ${error.message}\n`, 'utf8');
    }
}

/**
 * Uploads collected logs as GitHub Actions artifacts
 * @param {string[]} logFiles - Array of paths to log files
 * @param {string} artifactsDir - Directory containing artifacts
 */
async function uploadLogArtifacts(logFiles, artifactsDir) {
    try {
        const existingFiles = logFiles.filter(file => fs.existsSync(file));

        if (existingFiles.length === 0) {
            core.warning('No log files to upload');
            return;
        }

        await artifact.uploadArtifact('dataverse-logs', existingFiles, artifactsDir, {
            retentionDays: 14
        });

        core.info('✅ Successfully uploaded log artifacts');
    } catch (error) {
        throw new Error(`Artifact upload failed: ${error.message}`);
    }
}

/**
 * Tears down the Docker Compose stack and cleans up resources
 * @param {PostConfig} config - Post-run configuration
 */
async function cleanupDockerStack(config) {
    core.startGroup('🧹 Cleanup Dataverse stack');

    await exec.exec('docker', ['compose', '-f', config.composeFile, '-p', config.projectName, 'down', '-v']);
    core.info('✅ Successfully cleaned up Docker stack');

    core.endGroup();
}

run();