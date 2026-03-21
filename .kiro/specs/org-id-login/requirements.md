# Requirements Document

## Introduction

This feature replaces subdomain-based tenant resolution with an Organization ID entry step on the login page. Instead of navigating to `kazi.meetthehub.com` or `kfc.meetthehub.com`, users visit `meetthehub.com` and enter a short alphanumeric Organization ID (e.g., "KAZI", "KFC") before proceeding to the existing User ID / PIN login flow. The Organization ID scopes all subsequent authentication to the correct tenant, resolving the 4-digit PIN collision problem across tenants. The feature includes an on-screen virtual keyboard for kiosk environments without physical keyboards, and persistence of the selected organization via localStorage or IP-address association so returning users can skip re-entry.

## Glossary

- **Login_Page**: The client-side login page rendered at `/login` that handles the full authentication flow
- **Org_Entry_Screen**: The new initial screen on the Login_Page where users type their Organization ID before the PinPad appears
- **Organization_ID**: A short, case-insensitive alphanumeric code (2–10 characters) that uniquely identifies a tenant (e.g., "KAZI", "KFC")
- **Virtual_Keyboard**: An on-screen alphanumeric keyboard component rendered on the Org_Entry_Screen for kiosk devices without physical keyboards
- **Tenant_Resolver**: The server-side logic (middleware and API) that maps an Organization_ID to a tenant record in the database
- **Org_Persistence_Store**: The client-side mechanism (localStorage and optional IP-address association) that remembers a previously entered Organization_ID
- **PinPad**: The existing numeric keypad component used for User ID and PIN entry
- **Middleware**: The Next.js Edge middleware (`src/middleware.ts`) that injects tenant context headers into every request

## Requirements

### Requirement 1: Display Organization ID Entry Screen

**User Story:** As a kiosk user, I want to see an Organization ID entry screen when I open the login page, so that I can identify my organization before entering my credentials.

#### Acceptance Criteria

1. WHEN a user navigates to the Login_Page and no Organization_ID is persisted in the Org_Persistence_Store, THE Org_Entry_Screen SHALL display a text input field and prompt the user to enter their Organization_ID
2. WHEN a user navigates to the Login_Page and a valid Organization_ID is persisted in the Org_Persistence_Store, THE Login_Page SHALL skip the Org_Entry_Screen and proceed directly to the PinPad with the persisted Organization_ID applied
3. WHILE the Org_Entry_Screen is displayed, THE Login_Page SHALL hide the PinPad and User ID entry controls
4. THE Org_Entry_Screen SHALL display the application branding (logo and title) consistent with the existing Login_Page design

### Requirement 2: Validate Organization ID

**User Story:** As a kiosk user, I want the system to validate my Organization ID before I proceed, so that I know I am logging into the correct organization.

#### Acceptance Criteria

1. WHEN the user submits an Organization_ID on the Org_Entry_Screen, THE Tenant_Resolver SHALL look up the Organization_ID against the tenants table using a case-insensitive match on the tenant slug field
2. WHEN the Tenant_Resolver finds an active tenant matching the submitted Organization_ID, THE Login_Page SHALL display the tenant name as confirmation and advance to the PinPad step
3. IF the Tenant_Resolver does not find an active tenant matching the submitted Organization_ID, THEN THE Login_Page SHALL display an error message "Organization not found" and keep the user on the Org_Entry_Screen
4. IF the submitted Organization_ID is empty or shorter than 2 characters, THEN THE Login_Page SHALL display a validation error and keep the user on the Org_Entry_Screen
5. THE Tenant_Resolver SHALL rate-limit Organization_ID lookups to 10 attempts per IP address per 60-second window

### Requirement 3: Scope Authentication to Resolved Tenant

**User Story:** As a system operator, I want PIN authentication scoped to the selected organization, so that 4-digit PINs do not collide across tenants.

#### Acceptance Criteria

1. WHEN the Organization_ID is validated, THE Middleware SHALL set the `x-tenant-id` and `x-tenant-slug` request headers to the resolved tenant's identifier for all subsequent API requests
2. WHEN the user enters a User ID on the PinPad after Organization_ID validation, THE Tenant_Resolver SHALL look up the User ID scoped to the resolved tenant only
3. WHEN the user submits a PIN, THE Login_Page SHALL send the resolved tenant identifier along with the PIN to the login API
4. IF the user changes the Organization_ID (via the "Change Org" action), THEN THE Login_Page SHALL clear any in-progress User ID and PIN state and return to the Org_Entry_Screen

### Requirement 4: Virtual Keyboard for Kiosk Input

**User Story:** As a kiosk user without a physical keyboard, I want an on-screen alphanumeric keyboard on the Organization ID screen, so that I can type my Organization ID.

#### Acceptance Criteria

1. THE Org_Entry_Screen SHALL render a Virtual_Keyboard displaying alphanumeric keys (A–Z, 0–9), a backspace key, and a submit/enter key
2. WHEN the user taps a key on the Virtual_Keyboard, THE Org_Entry_Screen SHALL append the corresponding character to the Organization_ID input field
3. WHEN the user taps the backspace key on the Virtual_Keyboard, THE Org_Entry_Screen SHALL remove the last character from the Organization_ID input field
4. WHEN the user taps the submit key on the Virtual_Keyboard, THE Org_Entry_Screen SHALL trigger Organization_ID validation
5. WHILE a physical keyboard is available, THE Org_Entry_Screen SHALL accept typed input in the Organization_ID field in addition to Virtual_Keyboard taps

### Requirement 5: Persist Organization ID in localStorage

**User Story:** As a returning kiosk user, I want the system to remember my Organization ID, so that I do not have to re-enter it every time.

#### Acceptance Criteria

1. WHEN the Tenant_Resolver successfully validates an Organization_ID, THE Org_Persistence_Store SHALL save the Organization_ID to the browser's localStorage under a defined key
2. WHEN the Login_Page loads and a stored Organization_ID exists in localStorage, THE Login_Page SHALL validate the stored Organization_ID against the Tenant_Resolver before auto-advancing
3. IF the stored Organization_ID is no longer valid (tenant deactivated or removed), THEN THE Login_Page SHALL clear the stored value from localStorage and display the Org_Entry_Screen
4. THE Login_Page SHALL provide a visible "Change Organization" control that clears the stored Organization_ID from localStorage and returns to the Org_Entry_Screen

### Requirement 6: Associate Organization ID with IP Address

**User Story:** As a system operator, I want the option to associate an Organization ID with a device's IP address, so that kiosks on a known network can skip the Organization ID step entirely.

#### Acceptance Criteria

1. WHERE IP-based organization association is enabled, THE Tenant_Resolver SHALL provide an API endpoint that accepts an IP address and an Organization_ID and stores the mapping
2. WHERE IP-based organization association is enabled, WHEN the Login_Page loads, THE Tenant_Resolver SHALL check if the client's IP address has an associated Organization_ID and use it as the default
3. WHERE IP-based organization association is enabled, IF both an IP-based Organization_ID and a localStorage Organization_ID exist, THEN THE Org_Persistence_Store SHALL prefer the IP-based value
4. WHERE IP-based organization association is enabled, THE API endpoint for managing IP-to-Organization mappings SHALL require ARL-level or admin-level authentication

### Requirement 7: Update Middleware for Non-Subdomain Tenant Resolution

**User Story:** As a developer, I want the middleware to support tenant resolution without subdomains, so that the app works from a single `meetthehub.com` domain.

#### Acceptance Criteria

1. WHEN a request arrives at the root domain (`meetthehub.com`) with no subdomain, THE Middleware SHALL allow access to the Login_Page instead of redirecting to the landing page
2. WHEN a request arrives with an `x-org-id` cookie or header set by the Login_Page, THE Middleware SHALL resolve the tenant from the Organization_ID and set the `x-tenant-id` and `x-tenant-slug` headers accordingly
3. WHILE a subdomain is present in the request hostname, THE Middleware SHALL continue to resolve the tenant from the subdomain (backward compatibility)
4. IF a request to a protected route has no tenant context (no subdomain, no Organization_ID cookie, and no IP association), THEN THE Middleware SHALL redirect to the Login_Page

### Requirement 8: Tenant Branding After Organization Selection

**User Story:** As a kiosk user, I want to see my organization's branding after entering the Organization ID, so that I have visual confirmation I selected the correct organization.

#### Acceptance Criteria

1. WHEN the Organization_ID is validated and the tenant is resolved, THE Login_Page SHALL apply the tenant's primary color, logo, and app title to the page
2. WHEN the Organization_ID is validated, THE Login_Page SHALL display the tenant name prominently above the PinPad
3. IF the tenant has a custom favicon, THEN THE Login_Page SHALL update the browser favicon to the tenant's favicon after Organization_ID validation
