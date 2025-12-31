# Deploy Firestore Security Rules

The security rules for `matchedTrials` collection have been updated. You need to deploy them to Firebase.

## Option 1: Deploy via Firebase Console (Recommended)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Build** > **Firestore Database** > **Rules** tab
4. Copy the contents of `firestore.rules` file
5. Paste into the rules editor
6. Click **Publish**

## Option 2: Deploy via Firebase CLI

If you have Firebase CLI installed:

```bash
firebase deploy --only firestore:rules
```

## What Was Fixed

The `matchedTrials` collection security rules now properly allow:
- **Read**: Authenticated users can read their own saved trials
- **Create**: Authenticated users can save trials with their own patientId
- **Update**: Users can update their own saved trials
- **Delete**: Users can delete their own saved trials

The rules ensure that:
- Users can only access trials where `patientId == request.auth.uid`
- All operations require authentication (`request.auth != null`)
- The `patientId` field must match the authenticated user's UID

## Verify Deployment

After deploying, try saving a trial again. The permission errors should be resolved.

