# Dataverse Configbaker Action

![Tests](https://github.com/gdcc/dataverse-action/actions/workflows/test-action.yml/badge.svg)

This GitHub Action serves as a powerful tool to effortlessly create a functional Dataverse instance, enabling developers to run comprehensive tests and perform other critical tasks within their GitHub CI workflows.

## Usage

### Basic Usage

In order to use the baseline action you need to add the following to your workflow file:

```yaml
- name: Run Dataverse Action
  id: dataverse
  uses: gdcc/dataverse-action@main
```

This will create a Dataverse instance with the default configuration. The action will output the API token and base URL of the instance, which can be used to interact with the instance. Here is an example on how to re-use the API token and base URL in a subsequent step:

```yaml
- name: How to re-use outputs
  env:
    API_TOKEN: ${{ steps.dataverse.outputs.api_token }}
    BASE_URL: ${{ steps.dataverse.outputs.base_url }}
  run: |
    my-app --api-token "${{ env.API_TOKEN }}" --base-url "${{ env.BASE_URL }}"
```

### Advanced Usage with Presets

The action supports configuring through presets provided in the `src/presets.js` file. This functionality allows you to easily enable features like LocalStack for testing purposes. The action modifies the Docker Compose configuration to include the necessary JVM options for the selected presets.

#### Using LocalStack Preset

To enable the LocalStack S3 storage driver preset:

```yaml
- name: Run Dataverse with LocalStack
  id: dataverse
  uses: gdcc/dataverse-action@main
  with:
    presets: localstack
    min_part_size_mb: 10
```

#### Combining Presets with Custom JVM Options

You can combine storage driver presets with additional custom JVM options. The action will merge both the preset configurations and your custom options into the Dataverse environment:

```yaml
- name: Run Dataverse with LocalStack and custom options
  id: dataverse
  uses: gdcc/dataverse-action@main
  with:
    presets: localstack
    min_part_size_mb: 5
    jvm_options: |
      dataverse.spi.exporters.directory=/exports
      dataverse.files.directory=/data
```

#### Multiple Presets

The `presets` input accepts multiple preset names as a comma-separated or line-separated list:

```yaml
- name: Run Dataverse with multiple presets
  id: dataverse
  uses: gdcc/dataverse-action@main
  with:
    presets: |
      localstack
      custom
    min_part_size_mb: 10
```

Currently available presets:

- **localstack**: Configures a LocalStack S3 storage driver for local AWS cloud stack emulation during testing and development

## Inputs

| INPUT                | TYPE   | REQUIRED | DEFAULT                        | DESCRIPTION                                                                                                                                                                            |
| -------------------- | ------ | -------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image_tag`          | string | true     | `"unstable"`                   | Tag of image for Dataverse app and Configbaker                                                                                                                                         |
| `image_dataverse`    | string | true     | `"docker.io/gdcc/dataverse"`   | Name of Dataverse app image (can include registry)                                                                                                                                     |
| `image_configbaker`  | string | true     | `"docker.io/gdcc/configbaker"` | Name of Configbaker image (can include registry)                                                                                                                                       |
| `postgresql_version` | string | false    |                                | Override the PostgreSQL version to use. If not provided, the version will be detected from the Dataverse image labels                                                                  |
| `solr_version`       | string | false    |                                | Override the Solr version to use. If not provided, the version will be detected from the Dataverse image labels                                                                        |
| `jvm_options`        | string | false    |                                | Line-separated key-value pairs of JVM options to be set before startup. These options are merged with any preset configurations. Example: `dataverse.spi.exporters.directory=/exports` |
| `presets`            | string | false    | `""`                           | Comma or line-separated list of preset names to apply. Available presets: `localstack`. Multiple presets can be combined. Leave empty to use default file storage only                 |
| `min_part_size_mb`   | string | false    | `"5"`                          | Minimum part size for multipart uploads in megabytes. Must be at least 5MB as per AWS S3 requirements. Used by S3-compatible storage drivers configured through presets                |

## Outputs

| OUTPUT       | TYPE   | DESCRIPTION                                   |
| ------------ | ------ | --------------------------------------------- |
| `api_token`  | string | API Token of dataverseAdmin superuser         |
| `base_url`   | string | Base URL where to reach the instance via HTTP |
| `dv_version` | string | Dataverse version of the running instance     |

## How It Works

### Docker Compose Modification

When storage driver presets or custom JVM options are specified, the action automatically:

1. Parses the base `docker-compose.yml` file using the `js-yaml` library
2. Generates JVM options from the selected presets
3. Merges preset JVM options with any additional custom JVM options provided
4. Updates the `JVM_ARGS` environment variable in the `dataverse` service configuration
5. Writes a new compose file with the prefix `modified-docker-compose.yml`
6. Uses the modified compose file to start the Dataverse stack

This approach ensures that the YAML structure and formatting are preserved while making targeted modifications to the environment configuration. The original `docker-compose.yml` file remains unchanged.

### Storage Driver Presets

Storage driver presets are defined in `src/presets.js` and provide pre-configured JVM options for common storage backends. Each preset is a function that generates the appropriate JVM system properties based on the provided configuration options.

To add a new preset, define a function in `src/presets.js` and register it in the `PRESET_REGISTRY` object:

```javascript
export function myCustomPreset(mbytes) {
    return [
        "-Ddataverse.files.custom1.type=custom",
        "-Ddataverse.files.custom1.option=value",
        // ... more JVM options
    ];
}

export const PRESET_REGISTRY = {
    localstack: localStackPreset,
    custom: myCustomPreset
};
```

## Development

### Building

It is important to run the build command after any changes to the code, otherwise the changes will not be reflected in the action. To build the action, run the following command:

```bash
npm install
npm run build
```

### Testing

The project includes comprehensive unit tests and snapshot tests for the compose modification functionality. To run the tests:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

The snapshot tests verify that the Docker Compose file modifications produce the expected output. If you intentionally change the compose modification behavior, you may need to update the snapshots:

```bash
npm test -- -u
```

### Pre-commit Hook

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks. A pre-commit hook is automatically set up to build the action before each commit, ensuring the `dist/` files are always up-to-date.

The hook will:

- Automatically run `npm run build` before each commit
- Install dependencies if `node_modules` doesn't exist
- Verify that the build was successful
- Add the built files to the commit

#### Setup for New Contributors

**Automatic setup:** The pre-commit hook will be automatically set up when you run `npm install` for the first time.

**Manual setup:** If you need to manually set up the Git hooks, run:

```bash
npm run setup-hooks
```

#### Managing the Hook

**To disable the hook temporarily:**

```bash
chmod -x .husky/pre-commit
```

**To re-enable the hook:**

```bash
chmod +x .husky/pre-commit
```

**To test the hook manually:**

```bash
.husky/pre-commit
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
