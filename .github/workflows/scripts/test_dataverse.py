import os
from urllib.parse import urljoin
import requests


class TestNativeAPI:
    """
    This class contains test cases for the Dataverse Native API to validate
    that the Dataverse instance constructed by the Action is working as expected.

    Test cases:
        - Test the 'info' endpoint of the API.
        - Test the 'metadatablocks' endpoint of the API.
        - Test creating a collection using the API.
    """

    @staticmethod
    def construct_url(endpoint):
        """Helper method to construct a URL from an endpoint."""

        BASE_URL = os.environ["BASE_URL"]
        return urljoin(BASE_URL, endpoint)

    @staticmethod
    def construct_header():
        """Helper method to construct the header for the request."""

        return {"X-Dataverse-key": os.environ["API_TOKEN"]}

    def test_info(self):
        """
        Test the 'info' endpoint of the API.

        This method constructs the URL for the 'api/info/version' endpoint,
        sends a GET request to the URL, and asserts that the response status
        code is 200 and the 'status' field in the response JSON is 'OK'.
        """

        DV_VERSION = os.getenv("DV_VERSION")
        url = self.construct_url("api/info/version")
        response = requests.get(url)

        assert response.status_code == 200, response.text
        assert response.json()["status"] == "OK"
        assert response.json()["data"]["version"] == DV_VERSION

    def test_metadatablocks(self):
        """
        Test case for the 'metadatablocks' endpoint.

        This test verifies that the 'metadatablocks' endpoint returns a successful response
        with the expected metadata block information.

        It constructs the URL for the 'metadatablocks' endpoint, sends a GET request,
        and asserts that the response status code is 200 (OK) and the response JSON
        contains the expected metadata block information.

        Expected metadata block information:
        - displayName: "Citation Metadata"
        - name: "citation"
        """

        url = self.construct_url("api/metadatablocks")
        response = requests.get(url)

        assert response.status_code == 200, response.text
        assert response.json()["status"] == "OK"

        expected = {
            "displayName": "Citation Metadata",
            "name": "citation",
        }

        assert any(
            {
                block["name"] == expected["name"]
                and block["displayName"] == expected["displayName"]
                for block in response.json()["data"]
            }
        )

    def test_create_collection(self):
        """
        Test case for creating a collection.

        This test sends a POST request to the specified URL with the necessary headers and payload
        to create a collection in the dataverse. It then asserts that the response status code is 201
        and the response JSON contains a "status" key with the value "OK".
        """

        url = self.construct_url("api/dataverses/root")
        response = requests.post(
            url=url,
            headers=self.construct_header(),
            json={
                "name": "TestAction",
                "alias": "test_colleczion",
                "dataverseContacts": [
                    {"contactEmail": "burrito@burritoplace.com"},
                ],
                "affiliation": "Burrito Research University",
                "description": "We do all the (burrito) science.",
                "dataverseType": "LABORATORY",
            },
        )

        assert response.status_code == 201, response.text
        assert response.json()["status"] == "OK"

    def test_set_storage_driver(self):
        """
        Test case for setting the storage driver.

        This test creates a new collection, sets the storage driver to LocalStack,
        and then tests that the storage driver is set correctly.
        """

        # First create a new collection
        url = self.construct_url("api/dataverses/root")
        response = requests.post(
            url=url,
            headers=self.construct_header(),
            json={
                "name": "TestStorageDriver",
                "alias": "test_storage_driver",
                "dataverseContacts": [
                    {"contactEmail": "burrito@burritoplace.com"},
                ],
                "affiliation": "Burrito Research University",
                "description": "We do all the (burrito) science.",
                "dataverseType": "LABORATORY",
            },
        )

        # Next, set the storage driver to LocalStack
        url = self.construct_url(
            "api/admin/dataverse/test_storage_driver/storageDriver"
        )

        response = requests.put(
            url,
            headers=self.construct_header(),
            data="LocalStack",
        )

        assert response.status_code == 200, response.text
        assert response.json()["status"] == "OK"

        # Next, test the storage driver
        url = self.construct_url("api/dataverses/test_storage_driver/storageDriver")
        response = requests.get(url)

        assert response.status_code == 200, response.text
        assert response.json()["status"] == "OK"
        assert response.json()["data"]["message"] == "localstack1"
