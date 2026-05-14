# NuExis Feature Roadmap

This document outlines potential features and enhancements for the NuExis Digital Signage platform. These features are designed to be implemented in small, manageable steps.

## 1. Dashboard Enhancements (UI/UX)

*   **System Health Widget**:
    *   **What**: A small card at the top of the dashboard showing `Online Screens / Total Screens`.
    *   **Action**: Clicking the card redirects the user to the Screens page.
*   **Recent Activity Feed**:
    *   **What**: A simple list showing the last 5 events (e.g., "New asset uploaded", "Screen 'Lobby' paired").
    *   **Action**: Clicking an activity item takes you to the relevant management page.
*   **"Quick Pair" Button**:
    *   **What**: A prominent button in the Dashboard topbar.
    *   **Action**: Redirects to `/screens` and automatically triggers the "Add Screen" pairing modal.
*   **Storage Usage Meter**:
    *   **What**: A small progress bar showing how much of the team's storage quota is used.
    *   **Action**: Tooltip on hover showing exact bytes (e.g., "450MB / 1GB").

## 2. Screen Management Enhancements

*   **Quick Rename Button**:
    *   **What**: An "Edit" (pencil) icon next to each device name in the list.
    *   **Action**: Opens a small inline input to change the name without leaving the page.
*   **Remote Refresh Button**:
    *   **What**: A "Refresh" icon in the device row actions.
    *   **Action**: Sends a Supabase Realtime message to the Player, causing it to `window.location.reload()`.
*   **Screen Status Tooltip**:
    *   **What**: An info icon next to the "Online/Offline" status.
    *   **Action**: On hover, shows the exact `last_seen_at` timestamp and the device's current orientation.
*   **Screen Preview Button**:
    *   **What**: A "Preview" (eye) icon on each screen card.
    *   **Action**: Opens a small popup/modal showing a live (or last-cached) thumbnail of what the screen is currently displaying.

## 3. Asset Library Enhancements

*   **Asset Search Bar**:
    *   **What**: A search input field at the top of the Asset Library.
    *   **Action**: Filters the displayed assets in real-time as the user types.
*   **Asset Download Button**:
    *   **What**: A "Download" (down arrow) icon on each asset card.
    *   **Action**: Directly triggers a browser download of the original file from Supabase storage.
*   **Asset Tagging**:
    *   **What**: A "Add Tag" button on asset details.
    *   **Action**: Allows users to categorize assets (e.g., "Promo", "Menu", "Holiday") for better filtering.
*   **Image Zoom Preview**:
    *   **What**: Clicking on an asset thumbnail.
    *   **Action**: Opens the image in a full-screen lightbox/modal for closer inspection.

## 4. Player (Screen) Enhancements

*   **Clock Overlay Toggle**:
    *   **What**: A toggle button in the Player's hidden menu (accessible via the sidebar).
    *   **Action**: Shows/hides a small digital clock in the top-right corner of the playback screen.
*   **Diagnostic Overlay Button**:
    *   **What**: A "Diagnostics" button in the Player sidebar.
    *   **Action**: Toggles an overlay showing technical details: Resolution, User Agent, Cache Status (number of files cached), and Network Latency.
*   **Volume Slider**:
    *   **What**: A horizontal slider in the Player sidebar.
    *   **Action**: Adjusts the volume of video assets in real-time.
*   **Connection Lost Indicator**:
    *   **What**: A small "Offline" icon that appears automatically.
    *   **Action**: Displays in a corner if `navigator.onLine` becomes false, letting technicians know the screen is running from cache.

## 5. General & Productivity

*   **"Copy Player URL" Button**:
    *   **What**: A "Copy" icon next to the Player URL in the Dashboard or Screen Pairing modal.
    *   **Action**: Copies the full URL (e.g., `https://nuexis.app/player`) to the clipboard with a "Copied!" toast notification.
*   **Sidebar Theme Toggle**:
    *   **What**: A Sun/Moon icon button at the bottom of the Sidebar.
    *   **Action**: Switches the UI between Light and Dark mode (persisted in `localStorage`).
*   **Help & Documentation Button**:
    *   **What**: A "Help" (?) icon in the Sidebar.
    *   **Action**: Opens a small "Quick Start" guide modal explaining how to pair a screen.
