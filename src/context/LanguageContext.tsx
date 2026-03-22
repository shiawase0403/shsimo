import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Language = 'zh' | 'en';

interface Translations {
  [key: string]: {
    zh: string;
    en: string;
  };
}

export const translations: Translations = {
  // Common
  save: { zh: '保存', en: 'Save' },
  cancel: { zh: '取消', en: 'Cancel' },
  delete: { zh: '删除', en: 'Delete' },
  edit: { zh: '编辑', en: 'Edit' },
  add: { zh: '添加', en: 'Add' },
  search: { zh: '搜索', en: 'Search' },
  loading: { zh: '加载中...', en: 'Loading...' },
  close: { zh: '关闭', en: 'Close' },
  confirm: { zh: '确认', en: 'Confirm' },
  
  // Navigation
  dashboard: { zh: '仪表盘', en: 'Dashboard' },
  calendar: { zh: '日历', en: 'Calendar' },
  map: { zh: '地图', en: 'Map' },
  chat: { zh: '聊天', en: 'Chat' },
  settings: { zh: '账户', en: 'Account' },
  admin: { zh: '管理后台', en: 'Admin' },
  logout: { zh: '退出登录', en: 'Logout' },
  backToApp: { zh: '返回应用', en: 'Back to App' },
  volunteerSystem: { zh: '志愿者系统', en: 'Volunteer System' },
  
  // Login
  loginTitle: { zh: '登录', en: 'Sign In' },
  username: { zh: '用户名', en: 'Username' },
  password: { zh: '密码', en: 'Password' },
  loginBtn: { zh: '登录', en: 'Sign In' },
  loginFailed: { zh: '登录失败', en: 'Login failed' },
  
  // Dashboard
  welcome: { zh: '欢迎回来', en: 'Welcome back' },
  upcomingActivities: { zh: '即将到来的活动', en: 'Upcoming Activities' },
  noActivities: { zh: '暂无活动', en: 'No upcoming activities' },
  viewDetails: { zh: '查看详情', en: 'View Details' },
  todaysTasks: { zh: '今日任务', en: 'Today\'s Tasks' },
  noTasksRemaining: { zh: '今天没有剩余日程。', en: 'No tasks remaining for today.' },
  ongoing: { zh: '进行中', en: 'Ongoing' },
  todaysEvents: { zh: '今日活动', en: 'Today\'s Events' },
  noActivitiesRemaining: { zh: '今天没有剩余活动。', en: 'No activities remaining for today.' },
  active: { zh: '活跃', en: 'Active' },
  permanentVenue: { zh: '永久场地', en: 'Permanent Venue' },
  
  // Calendar
  calendarView: { zh: '日历视图', en: 'Calendar View' },
  noTasksScheduled: { zh: '今天没有安排任务。', en: 'No tasks scheduled for this day.' },
  mon: { zh: '周一', en: 'Mon' },
  tue: { zh: '周二', en: 'Tue' },
  wed: { zh: '周三', en: 'Wed' },
  thu: { zh: '周四', en: 'Thu' },
  fri: { zh: '周五', en: 'Fri' },
  sat: { zh: '周六', en: 'Sat' },
  sun: { zh: '周日', en: 'Sun' },
  
  // Map
  mapView: { zh: '地图视图', en: 'Map View' },
  unmappedLocations: { zh: '未在地图上标记的地点', en: 'Unmapped Locations' },
  allLocationsMapped: { zh: '所有地点都已标记', en: 'All locations mapped' },
  campusMapSimulated: { zh: '校园地图 (模拟)', en: 'Campus Map (Simulated)' },
  subAreas: { zh: '子区域', en: 'sub-areas' },
  subLocations: { zh: '子地点', en: 'Sub-Locations' },
  schedulesHere: { zh: '此处的排班', en: 'Schedules Here' },
  noSchedulesHere: { zh: '此处无排班。', en: 'No schedules here.' },
  activitiesHere: { zh: '此处的活动', en: 'Activities Here' },
  noActivitiesHere: { zh: '此处无活动。', en: 'No activities here.' },
  
  // Chat
  chatGroups: { zh: '聊天群组', en: 'Chat Groups' },
  typeMessage: { zh: '输入消息...', en: 'Type a message...' },
  members: { zh: '成员', en: 'Members' },
  connecting: { zh: '连接中...', en: 'Connecting...' },
  noChatGroups: { zh: '暂无聊天群组', en: 'No chat groups available.' },
  selectGroupToChat: { zh: '选择一个群组开始聊天', en: 'Select a group to start chatting' },
  leftGroup: { zh: '已退出', en: 'Left' },
  youAreNoLongerMember: { zh: '您已不再是该群组成员', en: 'You are no longer a member of this group' },
  noMembersFound: { zh: '未找到成员', en: 'No members found.' },
  online: { zh: '在线', en: 'online' },
  deletedAttachment: { zh: '已删除的日程/活动', en: 'Deleted Schedule/Activity' },
  attachScheduleOrActivity: { zh: '附加日程或活动', en: 'Attach Schedule or Activity' },
  schedule: { zh: '日程', en: 'Schedule' },
  activity: { zh: '活动', en: 'Activity' },
  
  // Settings
  profileSettings: { zh: '个人设置', en: 'Profile Settings' },
  accountSettings: { zh: '账户设置', en: 'Account Settings' },
  changePassword: { zh: '修改密码', en: 'Change Password' },
  currentPassword: { zh: '当前密码', en: 'Current Password' },
  newPassword: { zh: '新密码', en: 'New Password' },
  confirmNewPassword: { zh: '确认新密码', en: 'Confirm New Password' },
  updatePassword: { zh: '更新密码', en: 'Update Password' },
  updating: { zh: '更新中...', en: 'Updating...' },
  passwordMismatch: { zh: '两次输入的密码不一致', en: 'Passwords do not match' },
  passwordUpdated: { zh: '密码更新成功', en: 'Password updated successfully' },
  userTree: { zh: '用户树', en: 'User Tree' },
  yourPosition: { zh: '您的位置', en: 'Your Position' },
  adminUser: { zh: '管理员', en: 'Admin' },
  regularUser: { zh: '普通用户', en: 'User' },
  unassignedUsers: { zh: '未分配用户', en: 'Unassigned Users' },
  
  // Admin
  adminDashboard: { zh: '管理后台', en: 'Admin Dashboard' },
  usersAndGroups: { zh: '用户与群组', en: 'Users & Groups' },
  locations: { zh: '地点', en: 'Locations' },
  scheduleGroups: { zh: '日程组', en: 'Schedule Groups' },
  schedules: { zh: '日程', en: 'Schedules' },
  activities: { zh: '活动', en: 'Activities' },
  management: { zh: '管理', en: 'Management' },
  addUser: { zh: '添加用户', en: 'Add User' },
  addGroup: { zh: '添加群组', en: 'Add Group' },
  addNew: { zh: '添加', en: 'Add New' },
  nameTitle: { zh: '名称 / 标题', en: 'Name / Title' },
  details: { zh: '详情', en: 'Details' },
  actions: { zh: '操作', en: 'Actions' },
  emptyFolder: { zh: '此文件夹为空。', en: 'This folder is empty.' },
  role: { zh: '角色', en: 'Role' },
  usersCount: { zh: '用户数', en: 'users' },
  subLocationsCount: { zh: '子地点数', en: 'sub-locations' },
  loc: { zh: '地点', en: 'Loc' },
  type: { zh: '类型', en: 'Type' },
  root: { zh: '根目录', en: 'Root' },
  
  // Admin Form Fields
  id: { zh: 'ID', en: 'ID' },
  name: { zh: '名称', en: 'Name' },
  nicknameOptional: { zh: '昵称 (可选)', en: 'Nickname (Optional)' },
  title: { zh: '标题', en: 'Title' },
  color: { zh: '颜色', en: 'Color' },
  parentGroup: { zh: '父群组 (可选)', en: 'Parent Group (Optional)' },
  parentLocation: { zh: '父地点 (可选)', en: 'Parent Location (Optional)' },
  locationCoordinates: { zh: '地点坐标', en: 'Location Coordinates' },
  clickMapToSetLocation: { zh: '在地图上点击以设置坐标。', en: 'Click on the map to set the location coordinates.' },
  userGroupOptional: { zh: '用户组 (可选)', en: 'User Group (Optional)' },
  groupOptional: { zh: '群组 (可选)', en: 'Group (Optional)' },
  subGroups: { zh: '子群组', en: 'Sub-groups' },
  noSubGroups: { zh: '无子群组', en: 'No sub-groups' },
  usersInGroup: { zh: '群组中的用户', en: 'Users in this Group' },
  searchUsers: { zh: '搜索用户...', en: 'Search users...' },
  noUsersFound: { zh: '未找到用户', en: 'No users found' },
  usersSelected: { zh: '已选择用户', en: 'users selected' },
  location: { zh: '地点', en: 'Location' },
  selectLocation: { zh: '选择地点', en: 'Select Location' },
  startTime: { zh: '开始时间', en: 'Start Time' },
  endTime: { zh: '结束时间', en: 'End Time' },
  contactInfo: { zh: '联系信息 (可选)', en: 'Contact Info (Optional)' },
  notes: { zh: '备注 (可选)', en: 'Notes (Optional)' },
  timeType: { zh: '时间类型', en: 'Time Type' },
  selectType: { zh: '选择类型', en: 'Select Type' },
  permanent: { zh: '永久', en: 'Permanent' },
  dateRange: { zh: '日期范围', en: 'Date Range' },
  exactTime: { zh: '精确时间', en: 'Exact Time' },
  leaveBlankToKeep: { zh: '(留空以保持当前密码)', en: '(Leave blank to keep current)' },
  none: { zh: '无', en: 'None' },
  confirmDeletion: { zh: '确认删除', en: 'Confirm Deletion' },
  areYouSureDelete: { zh: '您确定要删除此项目吗？此操作无法撤销。', en: 'Are you sure you want to delete this item? This action cannot be undone.' },
  failedToDelete: { zh: '删除失败', en: 'Failed to delete' },
  errorDeleting: { zh: '删除时发生错误。', en: 'An error occurred while deleting.' },
  failedToUpdate: { zh: '更新项目失败', en: 'Failed to update item' },
  failedToAdd: { zh: '添加项目失败', en: 'Failed to add item' },
  errorUpdating: { zh: '更新时发生错误。', en: 'An error occurred while updating.' },
  errorAdding: { zh: '添加时发生错误。', en: 'An error occurred while adding.' },
  circularReference: { zh: '[循环引用]', en: '[Circular Reference]' },
  users: { zh: '用户', en: 'Users' },
  groups: { zh: '日程组', en: 'Schedule Groups' },
  userGroups: { zh: '用户组', en: 'User Groups' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'zh' || saved === 'en') ? saved : 'zh';
  });

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
