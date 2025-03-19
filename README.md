# PlayReadyProxy Setup Guide 🤔

### 1. Clone the repositories
   - First, clone the repositories [PlayReadyProxy](https://github.com/ThatNotEasy/PlayReadyProxy) and [PlayReadyProxy-API](https://github.com/ThatNotEasy/PlayReadyProxy-API) to your local machine.

### 2. Re-configure `PlayReadyProxy-API`
   - Navigate to the `PlayReadyProxy-API` directory for re-configuration.
   - Rename `.env.example` and `config.ini.example` to `.env` and `config.ini`, respectively.

### 3. Configure `config.ini`
   - Open and modify the `config.ini` file with the appropriate settings. For example:

    
    [PLAYREADY]
    DEVICE_FILE = device/myprd_file.prd
    DEVICE_NAME = NVIDIA
    

### 4. Set up virtual environment (venv) 🐍
   - Create a virtual environment (venv) and activate it.
   - Install the required dependencies from `requirements.txt`:

    
    pip install -r requirements.txt
    

### 5. Place your `.prd` file
   - Ensure that your `myprd_file.prd` file is located in the `device` directory.

### 6. Set up `PlayReadyProxy` Extension 🔑
   - The `NVIDIA` device name will be used in the [PlayReadyProxy](https://github.com/ThatNotEasy/PlayReadyProxy) extension.

### 7. Generate API Key 🔐
   - Once everything is set up, run `generate_apikey.py` to generate an API key:

    
    python generate_apikey.py
    

   - Example output after generation:

    
    Enter username: TEST
    Generated API key for 'new_user': TEST_3b6d0dfba92b63cbf41aaaa76fb493a8
    

### 8. Use the API Key
   - Use the generated API key `TEST_3b6d0dfba92b63cbf41aaaa76fb493a8` in the `PlayReadyProxy` extension configuration.

### 9. Extension Configuration Example 📑
   - Example configuration for the [PlayReadyProxy](https://github.com/ThatNotEasy/PlayReadyProxy) extension:

    
    {
        "security_level": "3000",  // Can be 2000 or 3000
        "host": "http://127.0.0.1:1337",
        "secret": "TEST_3b6d0dfba92b63cbf41aaaa76fb493a8",
        "device_name": "NVIDIA"
    }
    

   - Make sure to check the `device_name` and `secret` values carefully. These are obtained from the Backend (`PlayReadyProxy-API`).

### 10. Test the Setup 🖥️
   - Visit the following link to get the keys:
     [DASH.js PlayReady Example](https://reference.dashif.org/dash.js/v4.4.0/samples/drm/playready.html)

   - Check the terminal to see if the setup was successful.

### 11. Troubleshooting 🚨
   - If you encounter any issues or errors, please feel free to DM me on [Telegram](https://telegram.me/SurpriseMTFK).

## Credit & References:
- [DevLarley](https://github.com/DevLARLEY/WidevineProxy2)
