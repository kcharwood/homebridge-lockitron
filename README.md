
# Lockitron Plugin

Example config.json:

    {
      "accessories": [
        {
            "accessory": "Lockitron",
            "name": "Front Door",
            "lock_id": "your-lock-id",
            "api_token" : "your-lockitron-api-access-token"
        }
      ]
    }

This plugin supports Lockitron locks. It uses the Lockitron cloud API, so the Lockitron must be 'awake' for locking and unlocking to actually happen. You can wake up Lockitron after issuing an lock/unlock command by knocking on the door.

## Webhook Support (Advanced)

This plugin supports responding to Lockitron webhook events, which gives the added bonus of HomeKit being updated in real time for unlock events done outside the HomeKit ecosystem (for example, locking/unlocking it manually). This allows for a more reliable setup when creating advanced automations, to ensure events outside of HomeKit are registered in real time as well. However, this does require a more advanced setup called Port Forwarding in order to properly be configured.

### Lockitron Configuration
Your Lockitron app in your Lockitron developer dashboard has an entry for a webhook URI. Please enter a URI that is accessable from the internet. You most likely need admin access to your network in order to complete these steps. For most people, this will involve the following:

1. Determine your public facing IP address.
2. Determine your Homebridge machine's local IP Address
3. Setup Port Forwarding on your router to forward traffic from a public facing IP address and port to your local network's Homebridge IP address.
4. Enter your public facing IP address and port, plus the webhook endpoint (`/lockitron` by default)

For example, let's say that your router's public facing IP address is 100.99.88.77, and your Homebridge's local IP address is 192.168.1.10. You need to open a port in the router, and forward it to the Homebridge hardware (consult your router's documentation). The ports do not have to match. You can choose an external port (for example, 54321), and an internal port (for example, 8080). 

If you have configured everything properly, traffic that is sent to `http://100.99.88.77:54321/lockitron` should be forwarded along on your internal network to `http://192.168.10:8080/lockitron`

Finally, you would enter your public facing address for the webhook URI in the Lockitron Developer Dashboard, which is `http://100.99.88.77:54321/lockitron` in this example.

Please consult your network hardare manuals to further understand port forwarding.

### Homebridge Configuration

Specify a `webhook_port`, and optionally the `webhook_endpoint`. Note the webhook port is the port on your local network.

Example config.json:

    {
      "accessories": [
        {
            "accessory": "Lockitron",
            "name": "Front Door",
            "lock_id": "your-lock-id",
            "api_token" : "your-lockitron-api-access-token",
			"webhook_port" : 8080,
			"webhook_endpoint" : "/lockitron" #Optional - Defaults to `/lockitron`
        }
      ]
    }

Once this is completed, you should see webhook event in the console anytime you lock or unlock your Lockitron, and should see immediate updates in HomeKit to drive more advanced triggers. 