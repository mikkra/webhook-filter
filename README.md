# webhook-filter
This is a simple application that filters out push events for specific branches of specific repositories from a GitHub
webhook, forwarding all others to another destination.

## Configuration
All configuration is specified in a `config.json` file in the current working directory when launching the application.
The blacklist contains repo names and their corresponding blacklisted branches where each branch is a regex pattern. If any pattern for a given repo matches, the push event will not be forwarded to the configured webhook URL.

### Example
```json
{
  "rules": {
    "mikkra/vk-liker": {
      "secret": "some secret",
      "webhook": "https://some_webhook.site/hook",
      "branches": ["master", "dev"]
    }
  }
}
```
