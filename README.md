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

### Parameters

* `create-dv`: Whether to create a Dataverse to add data to or not. Default: `true`
* `port`: The port to run the Dataverse instance on. Default: `8080`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.