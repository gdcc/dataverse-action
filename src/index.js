import { fileURLToPath } from 'url';
import { dirname } from 'path';
import core from '@actions/core';
import exec from '@actions/exec';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __root = path.dirname(__dirname);

/**
 * Configuration object for the action
 * @typedef {Object} ActionConfig
 * @property {string} imageTag - Docker image tag to use
 * @property {string} imageDataverse - Dataverse image name
 * @property {string} imageConfigbaker - Configbaker image name
 * @property {string} postgresqlVersion - PostgreSQL version override
 * @property {string} solrVersion - Solr version override
 * @property {string} jvmOptions - JVM configuration options
 * @property {string} s3StorageDriver - S3 storage driver name (e.g., 'localstack')
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
        await setupJvmConfiguration(config);

        const composeConfig = await startDataverseStack();
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
    return {
        imageTag: core.getInput('image_tag', { required: true }),
        imageDataverse: core.getInput('image_dataverse', { required: true }),
        imageConfigbaker: core.getInput('image_configbaker', { required: true }),
        postgresqlVersion: core.getInput('postgresql_version'),
        solrVersion: core.getInput('solr_version'),
        jvmOptions: core.getInput('jvm_options') || '',
        s3StorageDriver: core.getInput('s3_storage_driver')
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
 * Sets up JVM configuration from input options
 * @param {ActionConfig} config - Action configuration
 */
async function setupJvmConfiguration(config) {
    const hasUserJvmOptions = config.jvmOptions.trim();
    const hasS3Storage = config.s3StorageDriver === 'localstack';

    const runnerTemp = process.env.RUNNER_TEMP || path.join(process.cwd(), 'tmp');
    const configDir = path.join(runnerTemp, 'dv', 'conf');
    fs.mkdirSync(configDir, { recursive: true });

    // Always export CONFIG_DIR for docker-compose to mount
    core.exportVariable('CONFIG_DIR', configDir);
    core.info(`Setting CONFIG_DIR: ${configDir}`);

    if (!hasUserJvmOptions && !hasS3Storage) return;

    core.info('Setting up JVM configuration...');

    // Parse user-provided JVM options (key=value lines) and create MicroProfile Config files
    if (hasUserJvmOptions) {
        for (const line of config.jvmOptions.split(/\r?\n/)) {
            if (!line.trim() || !line.includes('=')) continue;

            const [key, ...rest] = line.split('=');
            const value = rest.join('=');

            core.info(`Writing MicroProfile Config file: ${key} = ${value}`);
            fs.writeFileSync(path.join(configDir, key), value || '', 'utf8');
        }
    }

    // Setup LocalStack S3 storage if enabled
    if (hasS3Storage) {
        core.info('Configuring LocalStack S3 storage driver...');

        // Create MicroProfile Config files for S3 storage
        const localstackConfigs = {
            'dataverse.files.localstack1.type': 's3',
            'dataverse.files.localstack1.label': 'LocalStack',
            'dataverse.files.localstack1.custom-endpoint-url': 'http://localstack:4566',
            'dataverse.files.localstack1.custom-endpoint-region': 'us-east-2',
            'dataverse.files.localstack1.bucket-name': 'mybucket',
            'dataverse.files.localstack1.path-style-access': 'true',
            'dataverse.files.localstack1.upload-redirect': 'true',
            'dataverse.files.localstack1.download-redirect': 'true',
            'dataverse.files.localstack1.access-key': 'default',
            'dataverse.files.localstack1.secret-key': 'default'
        };

        for (const [key, value] of Object.entries(localstackConfigs)) {
            core.info(`Writing MicroProfile Config file: ${key} = ${value}`);
            fs.writeFileSync(path.join(configDir, key), value, 'utf8');
        }

        // Copy localstack init scripts to runtime directory
        const localstackDir = path.join(configDir, 'localstack');
        fs.mkdirSync(localstackDir, { recursive: true });

        const sourceScript = path.join(__root, 'dv', 'conf', 'localstack', 'init-s3.sh');
        const destScript = path.join(localstackDir, 'init-s3.sh');
        fs.copyFileSync(sourceScript, destScript);

        // Make the script executable
        fs.chmodSync(destScript, 0o755);
    }
}

/**
 * Starts the Dataverse Docker Compose stack
 * @returns {Promise<{composeFile: string, projectName: string}>} Compose configuration
 */
async function startDataverseStack() {
    const composeFile = path.join(process.env.GITHUB_ACTION_PATH || __root, 'docker-compose.yml');
    const projectName = 'apitest';

    // Save state for post-run cleanup
    core.saveState('compose_file', composeFile);
    core.saveState('compose_project', projectName);

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
    fs.mkdirSync(dvDir, { recursive: true });

    const exposeEnv = path.join(dvDir, 'bootstrap.exposed.env');
    fs.closeSync(fs.openSync(exposeEnv, 'a'));

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