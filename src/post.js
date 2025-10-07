import { fileURLToPath } from 'url';
import { dirname } from 'path';
import core from '@actions/core';
import exec from '@actions/exec';
import fs from 'fs';
import path from 'path';
import artifact from '@actions/artifact';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __root = path.dirname(__dirname);

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
 * Retrieves post-run configuration from saved state
 * @returns {PostConfig} Post-run configuration
 */
function getPostRunConfig() {
    const composeFile = core.getState('compose_file') ||
        path.join(process.env.GITHUB_ACTION_PATH || __root, 'docker-compose.yml');
    const projectName = core.getState('compose_project') || 'apitest';

    return { composeFile, projectName };
}

/**
 * Collects Dataverse logs and uploads them as artifacts
 * @param {PostConfig} config - Post-run configuration
 */
async function collectAndUploadLogs(config) {
    core.startGroup('📦 Collect and upload Dataverse logs');

    const artifactsDir = createArtifactsDirectory();
    const logFiles = await collectDataverseLogs(config, artifactsDir);

    for (const logFile of logFiles) {
        core.info(`Uploading log file: ${logFile}`);
        await uploadLogArtifacts(logFile, artifactsDir);
    }

    core.endGroup();
}

/**
 * Creates the artifacts directory for log collection
 * @returns {string} Path to artifacts directory
 */
function createArtifactsDirectory() {
    const artifactsDir = path.join(process.cwd(), 'artifacts');
    fs.mkdirSync(artifactsDir, { recursive: true });
    return artifactsDir;
}

/**
 * Collects Dataverse server logs from the container
 * @param {PostConfig} config - Post-run configuration
 * @param {string} artifactsDir - Directory to store artifacts
 * @returns {Promise<string[]>} Paths to the collected log files
 */
async function collectDataverseLogs(config, artifactsDir, additionalServices = []) {
    // Collect logs from all services to debug issues
    const logFiles = [];

    // Collect logs from dataverse
    const logFile = path.join(artifactsDir, 'dataverse-server.log');
    logFiles.push(logFile);
    core.info('Collecting logs via Docker Compose...');
    await collectComposeServiceLogs(config, logFile, 'dataverse');

    // Collect logs from postgres
    const postgresLogFile = path.join(artifactsDir, 'postgres.log');
    logFiles.push(postgresLogFile);
    await collectComposeServiceLogs(config, postgresLogFile, 'postgres');

    // Collect logs from solr
    const solrLogFile = path.join(artifactsDir, 'solr.log');
    logFiles.push(solrLogFile);
    await collectComposeServiceLogs(config, solrLogFile, 'solr');

    // Collect logs from smtp
    const smtpLogFile = path.join(artifactsDir, 'smtp.log');
    logFiles.push(smtpLogFile);
    await collectComposeServiceLogs(config, smtpLogFile, 'smtp');

    // Collect logs from additional services
    if (additionalServices.includes('localstack')) {
        const localstackLogFile = path.join(artifactsDir, 'localstack.log');
        logFiles.push(localstackLogFile);
        await collectComposeServiceLogs(config, localstackLogFile, 'localstack');
    }

    return logFiles;
}

/**
 * Collects logs from the Dataverse service via Docker Compose
 * @param {PostConfig} config - Post-run configuration
 * @param {string} logFile - Path where to save the log file
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
 * @param {string} logFile - Path to the log file
 * @param {string} artifactsDir - Directory containing artifacts
 */
async function uploadLogArtifacts(logFile, artifactsDir) {
    try {
        const files = fs.existsSync(logFile) ? [logFile] : [];

        if (files.length === 0) {
            core.warning('No log files to upload');
            return;
        }

        await artifact.uploadArtifact('dataverse-logs', files, artifactsDir, {
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