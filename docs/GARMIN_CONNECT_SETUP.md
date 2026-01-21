# Garmin Connect Integration Setup

This guide explains how to set up Garmin Connect API integration for syncing health/vitals data.

## Overview

Garmin Connect integration allows users to sync their health data from Garmin devices (watches, fitness trackers) directly into the CancerCare app. This includes:

- **Heart Rate** (resting, average)
- **PulseOx** (oxygen saturation)
- **Respiration Rate**
- **Stress Levels**
- **Sleep Data**
- **Body Metrics** (weight, temperature)

## Prerequisites

1. **Garmin Developer Program Approval**
   - Apply at: https://developer.garmin.com/gc-developer-program/
   - Garmin reviews applications (business/enterprise use cases preferred)
   - May require licensing fees depending on usage
   - Approval can take several weeks

2. **OAuth Credentials**
   - Once approved, you'll receive:
     - Consumer Key
     - Consumer Secret
     - OAuth 1.0a endpoints

## Setup Steps

### 1. Get Garmin Developer Credentials

After approval, you'll receive:
- `GARMIN_CONSUMER_KEY`
- `GARMIN_CONSUMER_SECRET`

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
REACT_APP_GARMIN_CONSUMER_KEY=your_consumer_key_here
REACT_APP_GARMIN_CONSUMER_SECRET=your_consumer_secret_here
```

### 3. Install OAuth Library (Optional but Recommended)

For production, use a proper OAuth 1.0a library:

```bash
npm install oauth-1.0a
```

Update `garminConnectService.js` to use the library instead of placeholder signature generation.

### 4. OAuth Flow Implementation

The integration uses OAuth 1.0a (3-legged OAuth):

1. **Initiate OAuth**: `initiateGarminOAuth(userId, callbackUrl)`
   - Returns authorization URL
   - User redirects to Garmin to authorize

2. **User Authorizes**: User grants permission in Garmin Connect

3. **Complete OAuth**: `completeGarminOAuth(userId, requestToken, requestTokenSecret, verifier)`
   - Exchanges tokens
   - Saves access tokens to Firestore

4. **Sync Data**: `syncGarminToVitals(userId, daysBack)`
   - Fetches health data from Garmin
   - Maps to CancerCare vital types
   - Saves to Firestore

## API Endpoints Used

### Health API
- **Daily Health Summary**: `/wellness-api/rest/dailyHealthSnapshot`
- Returns aggregated daily health metrics
- Includes: heart rate, stress, sleep, pulse ox, respiration

### Data Mapping

| Garmin Data Type | CancerCare Vital Type |
|-----------------|----------------------|
| RESTING_HEART_RATE | Heart Rate (hr) |
| PULSE_OX | Oxygen Saturation (spo2) |
| RESPIRATION | Respiratory Rate (rr) |
| BODY_TEMPERATURE | Temperature (temp) |
| BLOOD_PRESSURE | Blood Pressure (bp) |
| WEIGHT | Weight (weight) |

## Security Considerations

1. **Token Storage**: OAuth tokens are stored in Firestore `patients` collection
   - Consider encryption for production
   - Use Firestore security rules to protect tokens

2. **OAuth Callback**: Must use HTTPS in production
   - Configure callback URL in Garmin Developer Portal
   - Example: `https://yourdomain.com/garmin/callback`

3. **Permissions**: Users must explicitly authorize data access
   - Clear UI explaining what data will be accessed
   - Option to disconnect at any time

## Firestore Structure

Tokens are stored in the `patients` collection:

```javascript
{
  userId: "...",
  garminTokens: {
    accessToken: "...",
    accessTokenSecret: "...",
    tokenType: "Bearer",
    expiresAt: null
  },
  garminConnectedAt: "2024-01-15T10:00:00Z"
}
```

## Usage in UI

### Connect Button (VitalsSection)

```javascript
import garminService from '../../services/garminConnectService';

// Check if connected
const isConnected = await garminService.isGarminConnected(userId);

// Initiate OAuth
const { authUrl } = await garminService.initiateGarminOAuth(userId, callbackUrl);
window.location.href = authUrl;

// After authorization callback
await garminService.completeGarminOAuth(userId, requestToken, tokenSecret, verifier);

// Sync data
const result = await garminService.syncGarminToVitals(userId, 30); // 30 days
```

### Sync Button

```javascript
const handleSync = async () => {
  try {
    setIsSyncing(true);
    const result = await garminService.syncGarminToVitals(user.uid, 30);
    showSuccess(`Synced ${result.synced} data points from Garmin`);
    await reloadHealthData(); // Refresh UI
  } catch (error) {
    showError('Failed to sync Garmin data: ' + error.message);
  } finally {
    setIsSyncing(false);
  }
};
```

## Limitations

1. **OAuth 1.0a Complexity**: Requires proper signature generation
   - Use `oauth-1.0a` library for production
   - Current implementation has placeholder signatures

2. **Data Delay**: Garmin data may have a delay (usually synced hourly)
   - Not real-time
   - Historical data limited (typically 30-90 days)

3. **Device Dependency**: Requires Garmin device + Garmin Connect app
   - Users must sync devices regularly
   - Data only available after device sync

4. **API Rate Limits**: Garmin may have rate limits
   - Implement request throttling
   - Cache data to reduce API calls

## Testing

Without Garmin credentials, the service will:
- Show "not configured" warnings
- Prevent OAuth initiation
- Allow UI development/testing

To test fully:
1. Get Garmin Developer credentials
2. Set environment variables
3. Test OAuth flow in development
4. Verify data sync

## Troubleshooting

**"Garmin API credentials not configured"**
- Set `REACT_APP_GARMIN_CONSUMER_KEY` and `REACT_APP_GARMIN_CONSUMER_SECRET` in `.env`

**OAuth errors**
- Verify callback URL matches Garmin Developer Portal settings
- Ensure using HTTPS in production
- Check token expiration

**Data not syncing**
- Verify user authorized all required permissions
- Check Garmin device is syncing to Connect
- Review API rate limits
- Check Firestore permissions for token storage

## Next Steps

1. Complete OAuth 1.0a implementation using `oauth-1.0a` library
2. Add UI components for connect/disconnect/sync buttons
3. Implement automatic background sync (optional)
4. Add error handling and retry logic
5. Consider WebSocket/push notifications for real-time updates
