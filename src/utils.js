import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __root = path.dirname(__dirname);

/**
 * Gets the base compose file path (original, unmodified).
 * 
 * This function returns the path to the original docker-compose.yml file
 * that ships with the action. This file serves as the template for creating
 * modified versions with preset JVM options.
 * 
 * @returns {string} Path to the base docker-compose.yml file
 */
export function getBaseComposeFilePath() {
    return path.join(process.env.GITHUB_ACTION_PATH || __root, 'docker-compose.yml');
}

/**
 * Gets the modified compose file path if it exists, otherwise returns the base path.
 * 
 * This function checks if a modified compose file exists (created by applying presets)
 * and returns its path. If no modified version exists, it returns the original compose
 * file path as a fallback. This ensures that the system always has a valid compose file
 * to work with, whether or not presets were applied.
 * 
 * @returns {string} Path to the compose file (modified if exists, base otherwise)
 */
export function getActiveComposeFilePath() {
    const baseDir = process.env.GITHUB_ACTION_PATH || __root;
    const modifiedPath = path.join(baseDir, 'docker-compose.yml');

    // Return modified file if it exists, otherwise return base file
    if (fs.existsSync(modifiedPath)) {
        return modifiedPath;
    }

    return getBaseComposeFilePath();
}

/**
 * Gets the default project name for Docker Compose operations.
 * 
 * This function returns a consistent project name used across the action
 * lifecycle for Docker Compose operations. Using a consistent project name
 * ensures that the same containers can be managed across different stages
 * (startup, monitoring, cleanup).
 * 
 * @returns {string} The default Docker Compose project name
 */
export function getDefaultProjectName() {
    return 'apitest';
}

/**
 * Creates multiple directories recursively, ensuring parent directories exist.
 * This is a convenience wrapper around fs.mkdirSync with recursive option.
 * 
 * @param {...string} dirs - Directory paths to create
 */
export function ensureDirectories(...dirs) {
    for (const dir of dirs) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Copies all files from a source directory to a destination directory.
 * If the source directory doesn't exist, this function does nothing.
 * 
 * @param {string} srcDir - Source directory path
 * @param {string} destDir - Destination directory path
 * @param {Object} options - Copy options
 * @param {boolean} options.executable - Whether to make copied files executable (default: false)
 * @returns {number} Number of files copied
 */
export function copyDirectoryFiles(srcDir, destDir, { executable = false } = {}) {
    if (!fs.existsSync(srcDir)) {
        return 0;
    }

    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        fs.copyFileSync(srcPath, destPath);

        if (executable) {
            fs.chmodSync(destPath, 0o755);
        }
    }

    return files.length;
}

/**
 * Gets the standard volume mount paths for the Dataverse Docker setup.
 * Uses RUNNER_TEMP environment variable if available, otherwise falls back to local tmp directory.
 * 
 * @returns {Object} Object containing all volume mount paths
 */
export function getVolumeMountPaths() {
    const runnerTemp = process.env.RUNNER_TEMP || path.join(process.cwd(), 'tmp');

    return {
        runnerTemp,
        dvDir: path.join(runnerTemp, 'dv'),
        dvDataDir: path.join(runnerTemp, 'dv', 'data'),
        dvConfLocalstackDir: path.join(runnerTemp, 'dv', 'conf', 'localstack'),
        solrDataDir: path.join(runnerTemp, 'solr', 'data'),
        solrConfDir: path.join(runnerTemp, 'solr', 'conf')
    };
}

