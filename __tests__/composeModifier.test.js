import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { modifyComposeFile, parseJvmOptions, mergeJvmArgs } from '../src/composeModifier.js';
import { getPresetsJvmOptions } from '../src/presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __root = path.dirname(__dirname);

// Setup test fixtures
const fixturesDir = path.join(__dirname, 'fixtures');
const tempDir = path.join(__dirname, 'temp');

// Ensure directories exist
beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
});

// Clean up temp files after tests
afterAll(() => {
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
    }
});

describe('parseJvmOptions', () => {
    test('should parse line-separated JVM options', () => {
        const input = 'dataverse.spi.exporters.directory=/exports\ndataverse.files.directory=/data';
        const result = parseJvmOptions(input);

        expect(result).toEqual([
            '-Ddataverse.spi.exporters.directory=/exports',
            '-Ddataverse.files.directory=/data'
        ]);
    });

    test('should handle options that already have -D prefix', () => {
        const input = '-Ddataverse.spi.exporters.directory=/exports\n-Ddataverse.files.directory=/data';
        const result = parseJvmOptions(input);

        expect(result).toEqual([
            '-Ddataverse.spi.exporters.directory=/exports',
            '-Ddataverse.files.directory=/data'
        ]);
    });

    test('should filter empty lines', () => {
        const input = 'dataverse.spi.exporters.directory=/exports\n\n\ndataverse.files.directory=/data';
        const result = parseJvmOptions(input);

        expect(result).toEqual([
            '-Ddataverse.spi.exporters.directory=/exports',
            '-Ddataverse.files.directory=/data'
        ]);
    });

    test('should handle empty string', () => {
        expect(parseJvmOptions('')).toEqual([]);
    });

    test('should handle null/undefined', () => {
        expect(parseJvmOptions(null)).toEqual([]);
        expect(parseJvmOptions(undefined)).toEqual([]);
    });
});

describe('mergeJvmArgs', () => {
    test('should merge new options with existing ones', () => {
        const current = '-Ddataverse.files.storage-driver-id=file1';
        const newOptions = ['-Ddataverse.spi.exporters.directory=/exports'];

        const result = mergeJvmArgs(current, newOptions);

        expect(result).toBe('-Ddataverse.files.storage-driver-id=file1 -Ddataverse.spi.exporters.directory=/exports');
    });

    test('should handle empty current args', () => {
        const newOptions = ['-Ddataverse.spi.exporters.directory=/exports'];

        const result = mergeJvmArgs('', newOptions);

        expect(result).toBe('-Ddataverse.spi.exporters.directory=/exports');
    });

    test('should handle multiple new options', () => {
        const current = '-Ddataverse.files.storage-driver-id=file1';
        const newOptions = [
            '-Ddataverse.spi.exporters.directory=/exports',
            '-Ddataverse.files.directory=/data'
        ];

        const result = mergeJvmArgs(current, newOptions);

        expect(result).toBe('-Ddataverse.files.storage-driver-id=file1 -Ddataverse.spi.exporters.directory=/exports -Ddataverse.files.directory=/data');
    });

    test('should handle empty new options', () => {
        const current = '-Ddataverse.files.storage-driver-id=file1';

        const result = mergeJvmArgs(current, []);

        expect(result).toBe('-Ddataverse.files.storage-driver-id=file1');
    });
});

describe('modifyComposeFile', () => {
    const originalComposePath = path.join(__root, 'docker-compose.yml');

    test('should create modified compose file with localstack preset', () => {
        const modifiedPath = modifyComposeFile(originalComposePath, {
            presets: ['localstack'],
            additionalJvmOptions: '',
            mbytes: 10,
            serviceName: 'dataverse'
        });

        expect(fs.existsSync(modifiedPath)).toBe(true);

        const modifiedContent = fs.readFileSync(modifiedPath, 'utf8');

        // Should contain localstack configuration
        expect(modifiedContent).toContain('localstack1.type=s3');
        expect(modifiedContent).toContain('localstack1.custom-endpoint-url=http://localstack:4566');
        expect(modifiedContent).toContain('localstack1.min-part-size=10485760'); // 10MB in bytes

        // Clean up
        fs.unlinkSync(modifiedPath);
    });

    test('should create modified compose file with localstack preset and custom JVM options', () => {
        const modifiedPath = modifyComposeFile(originalComposePath, {
            presets: ['localstack'],
            additionalJvmOptions: 'dataverse.spi.exporters.directory=/exports\ndataverse.files.directory=/data',
            mbytes: 5,
            serviceName: 'dataverse'
        });

        expect(fs.existsSync(modifiedPath)).toBe(true);

        const modifiedContent = fs.readFileSync(modifiedPath, 'utf8');

        // Should contain localstack configuration
        expect(modifiedContent).toContain('localstack1.type=s3');

        // Should contain custom JVM options
        expect(modifiedContent).toContain('dataverse.spi.exporters.directory=/exports');
        expect(modifiedContent).toContain('dataverse.files.directory=/data');

        // Clean up
        fs.unlinkSync(modifiedPath);
    });

    test('should create modified compose file with only custom JVM options', () => {
        const modifiedPath = modifyComposeFile(originalComposePath, {
            presets: [],
            additionalJvmOptions: 'dataverse.spi.exporters.directory=/exports',
            mbytes: 5,
            serviceName: 'dataverse'
        });

        expect(fs.existsSync(modifiedPath)).toBe(true);

        const modifiedContent = fs.readFileSync(modifiedPath, 'utf8');

        // Should NOT contain localstack configuration
        expect(modifiedContent).not.toContain('localstack1.type=s3');

        // Should contain custom JVM option
        expect(modifiedContent).toContain('dataverse.spi.exporters.directory=/exports');

        // Clean up
        fs.unlinkSync(modifiedPath);
    });

    test('should throw error for invalid preset', () => {
        expect(() => {
            modifyComposeFile(originalComposePath, {
                presets: ['invalid-preset'],
                additionalJvmOptions: '',
                mbytes: 5,
                serviceName: 'dataverse'
            });
        }).toThrow("Preset 'invalid-preset' is not defined");
    });

    test('should throw error for invalid service name', () => {
        expect(() => {
            modifyComposeFile(originalComposePath, {
                presets: ['localstack'],
                additionalJvmOptions: '',
                mbytes: 5,
                serviceName: 'non-existent-service'
            });
        }).toThrow("Service 'non-existent-service' not found in compose file");
    });

    test('snapshot: modified compose file with localstack preset', () => {
        const modifiedPath = modifyComposeFile(originalComposePath, {
            presets: ['localstack'],
            additionalJvmOptions: '',
            mbytes: 5,
            serviceName: 'dataverse'
        });

        const modifiedContent = fs.readFileSync(modifiedPath, 'utf8');

        // Snapshot test for the entire modified compose file
        expect(modifiedContent).toMatchSnapshot();

        // Clean up
        fs.unlinkSync(modifiedPath);
    });

    test('snapshot: modified compose file with localstack preset and custom options', () => {
        const modifiedPath = modifyComposeFile(originalComposePath, {
            presets: ['localstack'],
            additionalJvmOptions: 'dataverse.spi.exporters.directory=/exports\ndataverse.files.directory=/data',
            mbytes: 10,
            serviceName: 'dataverse'
        });

        const modifiedContent = fs.readFileSync(modifiedPath, 'utf8');

        // Snapshot test for the entire modified compose file
        expect(modifiedContent).toMatchSnapshot();

        // Clean up
        fs.unlinkSync(modifiedPath);
    });
});

describe('getPresetsJvmOptions', () => {
    test('should get JVM options for localstack preset', () => {
        const options = getPresetsJvmOptions(['localstack'], { mbytes: 5 });

        expect(options).toContain('-Ddataverse.files.localstack1.type=s3');
        expect(options).toContain('-Ddataverse.files.localstack1.custom-endpoint-url=http://localstack:4566');
        expect(options).toContain('-Ddataverse.files.localstack1.min-part-size=5242880'); // 5MB in bytes
    });

    test('should throw error for undefined preset', () => {
        expect(() => {
            getPresetsJvmOptions(['undefined-preset'], { mbytes: 5 });
        }).toThrow("Preset 'undefined-preset' is not defined");
    });

    test('should use default mbytes value', () => {
        const options = getPresetsJvmOptions(['localstack']);

        expect(options).toContain('-Ddataverse.files.localstack1.min-part-size=5242880'); // 5MB in bytes
    });
});

