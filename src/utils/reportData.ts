import { api } from '../lib/api';

export interface DateRange {
  from: string;
  to: string;
}

export const fetchUserReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'created_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/users', params);
  if (error) throw error;
  return data || [];
};

export const fetchInventoryReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'created_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/inventory', params);
  if (error) throw error;
  return data || [];
};

export const fetchProcurementReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'created_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/procurement', params);
  if (error) throw error;
  return data || [];
};

export const fetchLeaveReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'created_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/leaves', params);
  if (error) throw error;
  return data || [];
};

export const fetchWorkReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'created_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/work', params);
  if (error) throw error;
  return data || [];
};

export const fetchFacilitiesReportData = async () => {
  const { data, error } = await api.get('/api/admin/reports/facilities', {
    order: 'created_at',
    ascending: 'false',
  });
  if (error) throw error;
  return data || [];
};

export const fetchRepositoryReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'uploaded_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/repository', params);
  if (error) throw error;
  return data || [];
};

export const fetchAuditLogReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'performed_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/audit-logs', params);
  if (error) throw error;
  return data || [];
};

export const fetchNotificationsReportData = async (dateRange?: DateRange) => {
  const params: Record<string, string> = {
    order: 'created_at',
    ascending: 'false',
  };
  if (dateRange) {
    params.from = dateRange.from;
    params.to = dateRange.to;
  }
  const { data, error } = await api.get('/api/admin/reports/notifications', params);
  if (error) throw error;
  return data || [];
};

export const calculateInventoryStats = (items: any[]) => {
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const lowStockItems = items.filter(item => item.quantity < 10).length;
  const categoryBreakdown = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { totalItems, totalQuantity, lowStockItems, categoryBreakdown };
};

export const calculateLeaveStats = (leaves: any[]) => {
  const totalRequests = leaves.length;
  const approved = leaves.filter(l => l.status === 'approved').length;
  const rejected = leaves.filter(l => l.status === 'rejected').length;
  const pending = leaves.filter(l => l.status === 'pending').length;

  const typeBreakdown = leaves.reduce((acc, leave) => {
    acc[leave.leave_type] = (acc[leave.leave_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { totalRequests, approved, rejected, pending, typeBreakdown };
};

export const calculateProcurementStats = (requests: any[]) => {
  const totalRequests = requests.length;
  const totalEstimatedCost = requests.reduce((sum, req) => sum + parseFloat(req.estimated_cost || 0), 0);

  const statusBreakdown = requests.reduce((acc, req) => {
    acc[req.status] = (acc[req.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryBreakdown = requests.reduce((acc, req) => {
    acc[req.category] = (acc[req.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { totalRequests, totalEstimatedCost, statusBreakdown, categoryBreakdown };
};

export const calculateWorkStats = (works: any[]) => {
  const totalWorks = works.length;
  const completed = works.filter(w => w.admin_status === 'completed').length;
  const onTrack = works.filter(w => w.admin_status === 'on_track').length;
  const needsAttention = works.filter(w => w.admin_status === 'needs_attention').length;

  const priorityBreakdown = works.reduce((acc, work) => {
    acc[work.priority] = (acc[work.priority] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return { totalWorks, completed, onTrack, needsAttention, priorityBreakdown };
};
