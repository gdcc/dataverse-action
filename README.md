# Dataverse Configbaker Action

This GitHub Action serves as a powerful tool to effortlessly create a functional Dataverse instance, enabling developers to run comprehensive tests and perform other critical tasks within their GitHub CI workflows.

## Usage

In order to use this action you need to add the following to your workflow file:

```yaml
name: Test Dataverse
uses: gdcc/dataverse-action@main
with:
    create-dv: true
```

## Inputs

<!-- AUTO-DOC-INPUT:START - Do not remove or modify this section -->

|                                         INPUT                                          |  TYPE  | REQUIRED |            DEFAULT             |                                                           DESCRIPTION                                                            |
|----------------------------------------------------------------------------------------|--------|----------|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
|              <a name="input_create-dv"></a>[create-dv](#input_create-dv)               | string |   true   |            `"true"`            |                                        Whether or not to create <br>an example Dataverse                                         |
|  <a name="input_image_configbaker"></a>[image_configbaker](#input_image_configbaker)   | string |   true   | `"docker.io/gdcc/configbaker"` |                                        Name of Configbaker image (can include registry)                                          |
|     <a name="input_image_dataverse"></a>[image_dataverse](#input_image_dataverse)      | string |   true   |  `"docker.io/gdcc/dataverse"`  |                                     Name of Dataverse app image <br>(can include registry)                                       |
|              <a name="input_image_tag"></a>[image_tag](#input_image_tag)               | string |   true   |          `"unstable"`          |                                       Tag of image for Dataverse <br>app and Configbaker                                         |
|           <a name="input_jvm_options"></a>[jvm_options](#input_jvm_options)            | string |  false   |                                | Line separated key-value pairs of <br>JVM options to be set <br>before startup. Example: dataverse.spi.exporters.directory=/...  |
| <a name="input_postgresql_version"></a>[postgresql_version](#input_postgresql_version) | string |  false   |                                |                                           Override the PostgreSQL version to <br>use                                             |
|          <a name="input_solr_version"></a>[solr_version](#input_solr_version)          | string |  false   |                                |                                              Override the Solr version to <br>use                                                |

<!-- AUTO-DOC-INPUT:END -->

## Outputs

<!-- AUTO-DOC-OUTPUT:START - Do not remove or modify this section -->

|                            OUTPUT                             |  TYPE  |                    DESCRIPTION                     |
|---------------------------------------------------------------|--------|----------------------------------------------------|
| <a name="output_api_token"></a>[api_token](#output_api_token) | string |       API Token of dataverseAdmin superuser        |
|  <a name="output_base_url"></a>[base_url](#output_base_url)   | string | Base URL where to reach <br>the instance via HTTP  |

<!-- AUTO-DOC-OUTPUT:END -->

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
