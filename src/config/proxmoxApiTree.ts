import type { ApiEndpoint } from "@/lib/types";

export const PROXMOX_API_TREE: ApiEndpoint[] = [
  {
    path: '/cluster',
    label: 'Cluster',
    description: 'Cluster-wide configuration and status',
    methods: ['GET'],
    isConfig: false,
    icon: 'Server',
    children: [
      {
        path: '/cluster/config',
        label: 'Config',
        methods: ['GET', 'POST'],
        isConfig: true,
        icon: 'Settings',
        children: [
          { path: '/cluster/config/nodes', label: 'Nodes', methods: ['GET'], isConfig: false },
          { path: '/cluster/config/join', label: 'Join Info', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/config/totem', label: 'Totem', methods: ['GET'], isConfig: false },
          { path: '/cluster/config/qdevice', label: 'QDevice', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/firewall',
        label: 'Firewall',
        methods: ['GET'],
        isConfig: false,
        icon: 'Shield',
        children: [
          { path: '/cluster/firewall/groups', label: 'Security Groups', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/rules', label: 'Rules', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/aliases', label: 'Aliases', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/ipset', label: 'IP Sets', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/firewall/options', label: 'Options', methods: ['GET', 'PUT'], isConfig: true },
          { path: '/cluster/firewall/macros', label: 'Macros', methods: ['GET'], isConfig: false },
          { path: '/cluster/firewall/refs', label: 'References', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/ha',
        label: 'HA',
        description: 'High Availability configuration',
        methods: ['GET'],
        isConfig: false,
        icon: 'HeartPulse',
        children: [
          { path: '/cluster/ha/resources', label: 'Resources', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/ha/groups', label: 'Groups', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/ha/status', label: 'Status', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/backup',
        label: 'Backup',
        methods: ['GET', 'POST'],
        isConfig: true,
        icon: 'Archive',
      },
      {
        path: '/cluster/backup-info',
        label: 'Backup Info',
        methods: ['GET'],
        isConfig: false,
        icon: 'Info',
        children: [
          { path: '/cluster/backup-info/not-backed-up', label: 'Not Backed Up', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/replication',
        label: 'Replication',
        methods: ['GET', 'POST'],
        isConfig: true,
        icon: 'Copy',
      },
      {
        path: '/cluster/acme',
        label: 'ACME',
        methods: ['GET'],
        isConfig: false,
        icon: 'Lock',
        children: [
          { path: '/cluster/acme/account', label: 'Accounts', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/acme/plugins', label: 'Plugins', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/acme/tos', label: 'Terms of Service', methods: ['GET'], isConfig: false },
          { path: '/cluster/acme/directories', label: 'Directories', methods: ['GET'], isConfig: false },
          { path: '/cluster/acme/meta', label: 'Meta', methods: ['GET'], isConfig: false },
          { path: '/cluster/acme/challenge-schema', label: 'Challenge Schema', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/ceph',
        label: 'Ceph',
        methods: ['GET'],
        isConfig: false,
        icon: 'Database',
        children: [
          { path: '/cluster/ceph/metadata', label: 'Metadata', methods: ['GET'], isConfig: false },
          { path: '/cluster/ceph/status', label: 'Status', methods: ['GET'], isConfig: false },
          { path: '/cluster/ceph/flags', label: 'Flags', methods: ['GET', 'PUT'], isConfig: true },
        ]
      },
      {
        path: '/cluster/jobs',
        label: 'Jobs',
        methods: ['GET'],
        isConfig: false,
        icon: 'Clock',
        children: [
          { path: '/cluster/jobs/schedule-analyze', label: 'Schedule Analyze', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/mapping',
        label: 'Mapping',
        methods: ['GET'],
        isConfig: false,
        icon: 'Map',
        children: [
          { path: '/cluster/mapping/pci', label: 'PCI', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/mapping/usb', label: 'USB', methods: ['GET', 'POST'], isConfig: true },
        ]
      },
      {
        path: '/cluster/metrics',
        label: 'Metrics',
        methods: ['GET'],
        isConfig: false,
        icon: 'BarChart',
        children: [
          { path: '/cluster/metrics/server', label: 'Server', methods: ['GET', 'POST'], isConfig: true },
        ]
      },
      {
        path: '/cluster/notifications',
        label: 'Notifications',
        methods: ['GET'],
        isConfig: false,
        icon: 'Bell',
        children: [
          { path: '/cluster/notifications/endpoints', label: 'Endpoints', methods: ['GET'], isConfig: false },
          { path: '/cluster/notifications/matchers', label: 'Matchers', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/notifications/targets', label: 'Targets', methods: ['GET'], isConfig: false },
        ]
      },
      {
        path: '/cluster/options',
        label: 'Options',
        methods: ['GET', 'PUT'],
        isConfig: true,
        icon: 'Sliders',
      },
      {
        path: '/cluster/sdn',
        label: 'SDN',
        description: 'Software Defined Networking',
        methods: ['GET', 'PUT'],
        isConfig: true,
        icon: 'Network',
        children: [
          { path: '/cluster/sdn/vnets', label: 'VNets', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/sdn/zones', label: 'Zones', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/sdn/controllers', label: 'Controllers', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/sdn/ipams', label: 'IPAM', methods: ['GET', 'POST'], isConfig: true },
          { path: '/cluster/sdn/dns', label: 'DNS', methods: ['GET', 'POST'], isConfig: true },
        ]
      },
      {
        path: '/cluster/resources',
        label: 'Resources',
        methods: ['GET'],
        isConfig: false,
        icon: 'Layers',
      },
      {
        path: '/cluster/status',
        label: 'Status',
        methods: ['GET'],
        isConfig: false,
        icon: 'Activity',
      },
      {
        path: '/cluster/tasks',
        label: 'Tasks',
        methods: ['GET'],
        isConfig: false,
        icon: 'ListTodo',
      },
      {
        path: '/cluster/log',
        label: 'Log',
        methods: ['GET'],
        isConfig: false,
        icon: 'FileText',
      },
      {
        path: '/cluster/nextid',
        label: 'Next ID',
        methods: ['GET'],
        isConfig: false,
        icon: 'Hash',
      },
    ]
  },
  {
    path: '/nodes',
    label: 'Nodes',
    description: 'Node-specific operations and status',
    methods: ['GET'],
    isConfig: false,
    icon: 'HardDrive',
    // Children are dynamic based on available nodes
  },
  {
    path: '/access',
    label: 'Access Control',
    description: 'User, group, and permission management',
    methods: ['GET'],
    isConfig: false,
    icon: 'Users',
    children: [
      { 
        path: '/access/users', 
        label: 'Users', 
        methods: ['GET', 'POST'], 
        isConfig: true,
        icon: 'User',
      },
      { 
        path: '/access/groups', 
        label: 'Groups', 
        methods: ['GET', 'POST'], 
        isConfig: true,
        icon: 'Users',
      },
      { 
        path: '/access/roles', 
        label: 'Roles', 
        methods: ['GET', 'POST'], 
        isConfig: true,
        icon: 'Shield',
      },
      { 
        path: '/access/acl', 
        label: 'ACL', 
        methods: ['GET', 'PUT'], 
        isConfig: true,
        icon: 'Lock',
      },
      { 
        path: '/access/domains', 
        label: 'Authentication', 
        methods: ['GET', 'POST'], 
        isConfig: true,
        icon: 'Key',
      },
      { 
        path: '/access/tfa', 
        label: 'Two-Factor Auth', 
        methods: ['GET', 'POST'], 
        isConfig: true,
        icon: 'Smartphone',
      },
      { 
        path: '/access/openid', 
        label: 'OpenID', 
        methods: ['GET', 'POST'], 
        isConfig: true,
        icon: 'ExternalLink',
      },
      { 
        path: '/access/permissions', 
        label: 'Permissions', 
        methods: ['GET'], 
        isConfig: false,
        icon: 'Eye',
      },
    ]
  },
  {
    path: '/pools',
    label: 'Pools',
    description: 'Resource pools for access control',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Layers',
  },
  {
    path: '/storage',
    label: 'Storage',
    description: 'Storage configuration',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Database',
  },
  {
    path: '/version',
    label: 'Version',
    description: 'API version information',
    methods: ['GET'],
    isConfig: false,
    icon: 'Info',
  },
];

// Node-level endpoints that are dynamically added per node
export const NODE_ENDPOINTS: ApiEndpoint[] = [
  {
    path: '/qemu',
    label: 'QEMU VMs',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Monitor',
  },
  {
    path: '/lxc',
    label: 'LXC Containers',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Box',
  },
  {
    path: '/storage',
    label: 'Storage',
    methods: ['GET'],
    isConfig: false,
    icon: 'Database',
  },
  {
    path: '/network',
    label: 'Network',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Network',
  },
  {
    path: '/disks',
    label: 'Disks',
    methods: ['GET'],
    isConfig: false,
    icon: 'HardDrive',
  },
  {
    path: '/ceph',
    label: 'Ceph',
    methods: ['GET'],
    isConfig: false,
    icon: 'Database',
  },
  {
    path: '/services',
    label: 'Services',
    methods: ['GET'],
    isConfig: false,
    icon: 'Settings',
  },
  {
    path: '/firewall',
    label: 'Firewall',
    methods: ['GET'],
    isConfig: false,
    icon: 'Shield',
    children: [
      { path: '/firewall/rules', label: 'Rules', methods: ['GET', 'POST'], isConfig: true },
      { path: '/firewall/options', label: 'Options', methods: ['GET', 'PUT'], isConfig: true },
      { path: '/firewall/log', label: 'Log', methods: ['GET'], isConfig: false },
    ]
  },
  {
    path: '/certificates',
    label: 'Certificates',
    methods: ['GET'],
    isConfig: false,
    icon: 'Lock',
    children: [
      { path: '/certificates/info', label: 'Info', methods: ['GET'], isConfig: false },
      { path: '/certificates/acme', label: 'ACME', methods: ['GET'], isConfig: false },
      { path: '/certificates/custom', label: 'Custom', methods: ['POST', 'DELETE'], isConfig: true },
    ]
  },
  {
    path: '/apt',
    label: 'APT',
    methods: ['GET'],
    isConfig: false,
    icon: 'Package',
    children: [
      { path: '/apt/update', label: 'Update', methods: ['GET', 'POST'], isConfig: true },
      { path: '/apt/versions', label: 'Versions', methods: ['GET'], isConfig: false },
      { path: '/apt/changelog', label: 'Changelog', methods: ['GET'], isConfig: false },
      { path: '/apt/repositories', label: 'Repositories', methods: ['GET', 'POST', 'PUT'], isConfig: true },
    ]
  },
  {
    path: '/tasks',
    label: 'Tasks',
    methods: ['GET'],
    isConfig: false,
    icon: 'ListTodo',
  },
  {
    path: '/syslog',
    label: 'Syslog',
    methods: ['GET'],
    isConfig: false,
    icon: 'FileText',
  },
  {
    path: '/status',
    label: 'Status',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Activity',
  },
  {
    path: '/dns',
    label: 'DNS',
    methods: ['GET', 'PUT'],
    isConfig: true,
    icon: 'Globe',
  },
  {
    path: '/time',
    label: 'Time',
    methods: ['GET', 'PUT'],
    isConfig: true,
    icon: 'Clock',
  },
  {
    path: '/hosts',
    label: 'Hosts',
    methods: ['GET', 'POST'],
    isConfig: true,
    icon: 'Server',
  },
  {
    path: '/subscription',
    label: 'Subscription',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    isConfig: true,
    icon: 'CreditCard',
  },
  {
    path: '/version',
    label: 'Version',
    methods: ['GET'],
    isConfig: false,
    icon: 'Info',
  },
];

// Helper to find an endpoint by path
export function findEndpointByPath(path: string, tree: ApiEndpoint[] = PROXMOX_API_TREE): ApiEndpoint | null {
  for (const endpoint of tree) {
    if (endpoint.path === path) return endpoint;
    if (endpoint.children) {
      const found = findEndpointByPath(path, endpoint.children);
      if (found) return found;
    }
  }
  return null;
}

// Helper to get breadcrumb trail for a path
export function getBreadcrumbsForPath(path: string, tree: ApiEndpoint[] = PROXMOX_API_TREE): ApiEndpoint[] {
  const breadcrumbs: ApiEndpoint[] = [];
  
  function search(endpoints: ApiEndpoint[], trail: ApiEndpoint[]): boolean {
    for (const endpoint of endpoints) {
      const newTrail = [...trail, endpoint];
      if (endpoint.path === path) {
        breadcrumbs.push(...newTrail);
        return true;
      }
      if (endpoint.children && search(endpoint.children, newTrail)) {
        return true;
      }
    }
    return false;
  }
  
  search(tree, []);
  return breadcrumbs;
}
