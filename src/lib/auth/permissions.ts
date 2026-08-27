// ============================================================
// RBAC Permissions System for TV Tech OS
// ============================================================

export type UserRole = 'ADMIN' | 'STAFF';

export const PERMISSIONS = {
  // Folder permissions
  FOLDER_CREATE: 'folder:create',
  FOLDER_UPDATE: 'folder:update',
  FOLDER_DELETE: 'folder:delete',
  FOLDER_MOVE:   'folder:move',

  // FolderItem junction permissions
  FOLDER_ITEM_LINK:   'folder_item:link',
  FOLDER_ITEM_UNLINK: 'folder_item:unlink',
  FOLDER_ITEM_BATCH:  'folder_item:batch',

  // Item domain entity permissions
  ITEM_CREATE:   'item:create',
  ITEM_UPDATE:   'item:update',
  ITEM_DELETE:   'item:delete',

  // Stock & Movement permissions (Staff allowed)
  QUANTITY_UPDATE:       'quantity:update',       // Event-sourced stock movement only
  STOCK_TOGGLE:          'stock:toggle',          // Mark out of stock
  STOCK_MOVEMENT_CREATE: 'stock_movement:create',
  STOCK_MOVEMENT_VIEW:   'stock_movement:view',

  // Supplier & Price History permissions
  SUPPLIER_CREATE:        'supplier:create',
  SUPPLIER_UPDATE:        'supplier:update',
  SUPPLIER_DELETE:        'supplier:delete',
  SUPPLIER_RECORD_CREATE: 'supplier_record:create',
  SUPPLIER_RECORD_DELETE: 'supplier_record:delete',

  // Purchase Manager permissions
  PURCHASE_LIST_VIEW:   'purchase_list:view',
  PURCHASE_LIST_CREATE: 'purchase_list:create',
  PURCHASE_LIST_UPDATE: 'purchase_list:update',
  PURCHASE_LIST_DELETE: 'purchase_list:delete',
  PURCHASE_LIST_PDF:    'purchase_list:pdf',

  // Analytics & Parameters
  ANALYTICS_VIEW:       'analytics:view',
  MIN_STOCK_SET:        'min_stock:set',
  NEED_PURCHASE_TOGGLE: 'need_purchase:toggle',
  PARAMETER_MANAGE:     'parameter:manage',

  // Knowledge Base permissions (Granted to both Admin and Staff)
  KB_BRAND_MANAGE:    'kb_brand:manage',
  KB_MODEL_MANAGE:    'kb_model:manage',
  KB_FOLDER_MANAGE:   'kb_folder:manage',
  KB_MEDIA_MANAGE:    'kb_media:manage',
  KB_PAGE_MANAGE:     'kb_page:manage',
  KB_LINK_MANAGE:     'kb_link:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  ADMIN: new Set(Object.values(PERMISSIONS)),
  STAFF: new Set([
    PERMISSIONS.QUANTITY_UPDATE,
    PERMISSIONS.STOCK_TOGGLE,
    PERMISSIONS.STOCK_MOVEMENT_CREATE,
    PERMISSIONS.STOCK_MOVEMENT_VIEW,
    PERMISSIONS.PURCHASE_LIST_VIEW,
    PERMISSIONS.PURCHASE_LIST_PDF,
    PERMISSIONS.ANALYTICS_VIEW,
    // Knowledge Base — All permissions granted to Staff
    PERMISSIONS.KB_BRAND_MANAGE,
    PERMISSIONS.KB_MODEL_MANAGE,
    PERMISSIONS.KB_FOLDER_MANAGE,
    PERMISSIONS.KB_MEDIA_MANAGE,
    PERMISSIONS.KB_PAGE_MANAGE,
    PERMISSIONS.KB_LINK_MANAGE,
  ]),
};

export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.has(permission) : false;
}
