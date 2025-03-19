# Dataverse Configbaker Action

![Tests](https://github.com/gdcc/dataverse-action/actions/workflows/test-action.yml/badge.svg)

This GitHub Action serves as a powerful tool to effortlessly create a functional Dataverse instance, enabling developers to run comprehensive tests and perform other critical tasks within their GitHub CI workflows.

## Usage

In order to use the baseline action you need to add the following to your workflow file:

```yaml
name: Run Dataverse Action
id: dataverse
uses: gdcc/dataverse-action@main
```

This will create a Dataverse instance with the default configuration. The action will output the API token and base URL of the instance, which can be used to interact with the instance. Here is an example on how to re-use the API token and base URL in a subsequent step:

```yaml
name: How to re-use outputs
env:
    API_TOKEN: ${{ steps.dataverse.outputs.api_token }}
    BASE_URL: ${{ steps.dataverse.outputs.base_url }}
run: |
    my-app --api-token "${{ env.API_TOKEN }}" --base-url "${{ env.BASE_URL }}"
```

## Inputs

<!-- AUTO-DOC-INPUT:START - Do not remove or modify this section -->

|                                         INPUT                                          |  TYPE  | REQUIRED |            DEFAULT             |                                                           DESCRIPTION                                                            |
|----------------------------------------------------------------------------------------|--------|----------|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
|  <a name="input_image_configbaker"></a>[image_configbaker](#input_image_configbaker)   | string |   true   | `"docker.io/gdcc/configbaker"` |                                        Name of Configbaker image (can include registry)                                          |
|     <a name="input_image_dataverse"></a>[image_dataverse](#input_image_dataverse)      | string |   true   |  `"docker.io/gdcc/dataverse"`  |                                     Name of Dataverse app image <br>(can include registry)                                       |
|              <a name="input_image_tag"></a>[image_tag](#input_image_tag)               | string |   true   |          `"unstable"`          |                                       Tag of image for Dataverse <br>app and Configbaker                                         |
|           <a name="input_jvm_options"></a>[jvm_options](#input_jvm_options)            | string |  false   |                                | Line separated key-value pairs of <br>JVM options to be set <br>before startup. Example: dataverse.spi.exporters.directory=/...  |
| <a name="input_postgresql_version"></a>[postgresql_version](#input_postgresql_version) | string |  false   |                                |                                           Override the PostgreSQL version to <br>use                                             |
|          <a name="input_solr_version"></a>[solr_version](#input_solr_version)          | string |  false   |                                |                                              Override the Solr version to <br>use                                                |

<!-- AUTO-DOC-INPUT:END -->

## Outputs

<!-- AUTO-DOC-OUTPUT:START - Do not remove or modify this section -->

|                              OUTPUT                              |  TYPE  |                    DESCRIPTION                     |
|------------------------------------------------------------------|--------|----------------------------------------------------|
|  <a name="output_api_token"></a>[api_token](#output_api_token)   | string |       API Token of dataverseAdmin superuser        |
|    <a name="output_base_url"></a>[base_url](#output_base_url)    | string | Base URL where to reach <br>the instance via HTTP  |
| <a name="output_dv_version"></a>[dv_version](#output_dv_version) | string |                 Dataverse version                  |

<!-- AUTO-DOC-OUTPUT:END -->

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
