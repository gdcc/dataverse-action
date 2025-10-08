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
    const modifiedPath = path.join(baseDir, 'modified-docker-compose.yml');

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

