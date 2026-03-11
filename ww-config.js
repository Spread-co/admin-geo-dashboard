export default {
  editor: {
    label: { en: 'Admin Geo Dashboard' },
    icon: 'map',
    categories: ['content'],
    deprecated: false,
  },
  triggerEvents: [
    {
      name: 'region:selected',
      label: { en: 'On Region Selected' },
      event: {
        region_id: '',
        region_name: '',
        state_name: '',
        is_open: false,
        utilisation_pct: 0,
      },
    },
    {
      name: 'capacity:updated',
      label: { en: 'On Capacity Updated' },
      event: {
        region_id: '',
        success: true,
        message: '',
      },
    },
    {
      name: 'region:toggled',
      label: { en: 'On Region Toggled' },
      event: {
        region_id: '',
        is_open: false,
      },
    },
    {
      name: 'region:activated',
      label: { en: 'On Region Activated' },
      event: {
        region_id: '',
        region_name: '',
      },
    },
    {
      name: 'error',
      label: { en: 'On Error' },
      event: {
        message: '',
        code: '',
      },
    },
  ],
  properties: {
    supabaseUrl: {
      label: { en: 'Supabase URL' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    supabaseAnonKey: {
      label: { en: 'Supabase Anon Key' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    accessToken: {
      label: { en: 'Auth Token' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    refreshTrigger: {
      label: { en: 'Refresh Trigger' },
      type: 'Text',
      bindable: true,
      defaultValue: '',
      hidden: true,
    },
    defaultView: {
      label: { en: 'Default View' },
      type: 'TextSelect',
      options: {
        options: [
          { value: 'au', label: { en: 'Australia' } },
          { value: 'world', label: { en: 'International' } },
        ],
      },
      defaultValue: 'au',
    },
    mapHeight: {
      label: { en: 'Map Height (px)' },
      type: 'Number',
      bindable: true,
      defaultValue: 600,
    },
    pollingInterval: {
      label: { en: 'Polling Interval (seconds)' },
      type: 'Number',
      bindable: true,
      defaultValue: 60,
    },
    showWaitlistOverlay: {
      label: { en: 'Show Waitlist Overlay' },
      type: 'OnOff',
      defaultValue: true,
    },
  },
};
