# Onboarding Flow

## Overview

New users complete a 4-step onboarding process that collects essential patient information before accessing the app.

---

## When Onboarding Shows

**Onboarding appears when:**
1. ✅ User signs up for the first time (no patient profile exists)
2. ✅ User has incomplete profile (missing firstName or diagnosis)

**Onboarding skipped when:**
- ❌ User already has complete profile
- ❌ User logs in with existing complete profile

---

## 4-Step Onboarding Process

### Step 1: Personal Information

**Required Fields:**
- First Name *
- Last Name *
- Date of Birth *
- Gender *

**Captured Data:**
```javascript
{
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1966-03-15",
  gender: "female"
}
```

**Auto-calculated:**
- Age (calculated from DOB)

---

### Step 2: Contact Information

**Required Fields:**
- Phone Number *
- City *
- State *

**Optional Fields:**
- Address
- ZIP Code

**Captured Data:**
```javascript
{
  phone: "(555) 123-4567",
  address: "123 Main St",
  city: "Seattle",
  state: "WA",
  zip: "98109"
}
```

---

### Step 3: Medical Information

**Required Fields:**
- Diagnosis *
- Diagnosis Date *

**Optional Fields:**
- Cancer Type
- Stage
- Oncologist Name
- Hospital/Clinic

**Captured Data:**
```javascript
{
  diagnosis: "Ovarian Cancer",
  diagnosisDate: "2024-01-15",
  cancerType: "Clear Cell",
  stage: "Stage IIIC",
  oncologist: "Dr. Jane Smith",
  hospital: "Seattle Cancer Care Alliance"
}
```

---

### Step 4: Emergency Contact

**Required Fields:**
- Contact Name *
- Contact Phone *
- Relationship *

**Captured Data:**
```javascript
{
  emergencyContactName: "John Doe",
  emergencyContactPhone: "(555) 987-6543",
  emergencyContactRelationship: "spouse"
}
```

**Relationship Options:**
- Spouse
- Partner
- Parent
- Child
- Sibling
- Friend
- Other

---

## What Gets Saved to Firestore

### Patient Profile (`patients/{userId}`)

```javascript
{
  // Auth Info
  id: "userId123",
  email: "jane@example.com",
  displayName: "Jane Doe",

  // Personal Info
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1966-03-15",
  age: 58,
  gender: "female",

  // Contact Info
  phone: "(555) 123-4567",
  address: "123 Main St",
  city: "Seattle",
  state: "WA",
  zip: "98109",

  // Medical Info
  diagnosis: "Ovarian Cancer",
  diagnosisDate: "2024-01-15",
  cancerType: "Clear Cell",
  stage: "Stage IIIC",
  oncologist: "Dr. Jane Smith",
  hospital: "Seattle Cancer Care Alliance",

  // System Fields
  profileComplete: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### Emergency Contact (`emergencyContacts/{contactId}`)

```javascript
{
  id: "contactId123",
  patientId: "userId123",
  name: "John Doe",
  phone: "(555) 987-6543",
  relationship: "spouse",
  isPrimary: true,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

## User Experience

### New User Journey

```
1. Sign Up (Email/Google)
   ↓
2. Login Successful
   ↓
3. System checks: No patient profile exists
   ↓
4. Shows Onboarding Screen
   ↓
5. User completes 4 steps
   ↓
6. Click "Complete Setup"
   ↓
7. Data saved to Firestore
   ↓
8. Onboarding closes
   ↓
9. Main app loads
```

### Returning User Journey

```
1. Login (Email/Google)
   ↓
2. System checks: Profile exists & complete
   ↓
3. Onboarding skipped
   ↓
4. Main app loads immediately
```

---

## UI Features

### Progress Indicator
- Visual progress bar (4 steps)
- Current step highlighted
- Step number displayed

### Validation
- Real-time field validation
- Required fields marked with *
- Next button disabled until step is valid
- Clear error messages

### Navigation
- Back button (disabled on step 1)
- Next button (steps 1-3)
- Complete Setup button (step 4)

### Design
- Beautiful gradient background
- Animated transitions between steps
- Step-specific icons
- Helpful descriptions
- Mobile responsive

---

## Validation Rules

### Step 1 - Personal Info
```javascript
isValid = firstName && lastName && dateOfBirth && gender
```

### Step 2 - Contact Info
```javascript
isValid = phone && city && state
```

### Step 3 - Medical Info
```javascript
isValid = diagnosis && diagnosisDate
```

### Step 4 - Emergency Contact
```javascript
isValid = emergencyContactName &&
          emergencyContactPhone &&
          emergencyContactRelationship
```

---

## Technical Implementation

### Component
```javascript
<Onboarding onComplete={handleOnboardingComplete} />
```

### Props
- `onComplete(formData)` - Callback when onboarding finishes

### State Management
```javascript
const [needsOnboarding, setNeedsOnboarding] = useState(false);
```

### Completion Handler
```javascript
const handleOnboardingComplete = async (formData) => {
  // Calculate age
  const age = calculateAge(formData.dateOfBirth);

  // Save patient profile
  await patientService.savePatient(userId, {
    ...formData,
    age,
    profileComplete: true
  });

  // Save emergency contact
  await emergencyContactService.saveEmergencyContact({
    patientId: userId,
    ...formData.emergencyContact,
    isPrimary: true
  });

  // Close onboarding
  setNeedsOnboarding(false);
};
```

---

## Skipping Onboarding (Development)

For testing, you can skip onboarding by manually creating a complete profile:

```javascript
// In Firestore Console, create:
patients/{userId}
{
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  diagnosis: "Cancer",
  profileComplete: true,
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now()
}
```

---

## Editing Profile Later

Users can update their information later from:
- Profile tab
- Settings menu (future feature)

The onboarding won't show again once `profileComplete: true` is set.

---

## Benefits

✅ **Complete Profiles:** Ensures all users have essential info
✅ **Better UX:** Personalized experience from day 1
✅ **Data Quality:** Structured, validated data
✅ **Emergency Prep:** Always have emergency contact on file
✅ **One-Time:** Never bothers returning users
✅ **Optional Fields:** Flexible - only critical fields required

---

## Future Enhancements

- [ ] Skip & complete later option
- [ ] Profile picture upload
- [ ] Insurance information
- [ ] Medication list during onboarding
- [ ] Multiple emergency contacts
- [ ] Import from EHR
- [ ] Progress saving (resume partial onboarding)

---

## Testing Onboarding

### Test New User Flow

1. **Create New Account:**
   ```
   Email: newuser@test.com
   Password: test123
   ```

2. **Observe:**
   - Login successful
   - Onboarding screen appears
   - 4 steps shown

3. **Complete Each Step:**
   - Step 1: Enter name, DOB, gender
   - Step 2: Enter phone, city, state
   - Step 3: Enter diagnosis info
   - Step 4: Enter emergency contact

4. **Verify:**
   - Data saved to Firestore
   - Main app loads
   - Profile shows correct info

### Test Returning User

1. **Log Out**
2. **Log Back In**
3. **Observe:**
   - No onboarding screen
   - Main app loads directly

### Test Incomplete Profile

1. **Manually delete `firstName` from Firestore**
2. **Log Out & Log Back In**
3. **Observe:**
   - Onboarding appears again
   - Can complete profile

---

## Summary

Onboarding ensures every user has:
- ✅ Personal information
- ✅ Contact details
- ✅ Medical diagnosis info
- ✅ Emergency contact

**Result:** Better data quality, personalized experience, and safer patient management! 🎉
