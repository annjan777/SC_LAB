// @ts-nocheck
import { PDFReportGenerator, TableColumn, SummaryItem } from './pdfGenerator';
import {
  DateRange,
  fetchUserReportData,
  fetchInventoryReportData,
  fetchProcurementReportData,
  fetchLeaveReportData,
  fetchWorkReportData,
  fetchFacilitiesReportData,
  fetchRepositoryReportData,
  fetchAuditLogReportData,
  calculateInventoryStats,
  calculateLeaveStats,
  calculateProcurementStats,
  calculateWorkStats,
} from './reportData';

export const generateUserDirectoryReport = async (dateRange?: DateRange) => {
  const users = await fetchUserReportData(dateRange);
  const pdf = new PDFReportGenerator('portrait');

  pdf.addHeader({
    title: 'User Directory Report',
    subtitle: 'Complete list of lab members with contact information',
    dateRange,
  });

  const summary: SummaryItem[] = [
    { label: 'Total Users', value: users.length },
    { label: 'Active Users', value: users.filter(u => u.is_active).length },
    { label: 'Inactive Users', value: users.filter(u => !u.is_active).length },
    { label: 'Administrators', value: users.filter(u => u.user_role === 'admin').length },
  ];

  pdf.addSummarySection('Summary Statistics', summary);

  const columns: TableColumn[] = [
    { header: 'Name', dataKey: 'full_name' },
    { header: 'Email', dataKey: 'email' },
    { header: 'Department', dataKey: 'department' },
    { header: 'Program', dataKey: 'program_designation' },
    { header: 'Role', dataKey: 'user_role' },
    { header: 'Status', dataKey: 'is_active_text' },
  ];

  const tableData = users.map(user => ({
    ...user,
    is_active_text: user.is_active ? 'Active' : 'Inactive',
  }));

  pdf.addTable(columns, tableData, 'User Details');

  pdf.download(`user_directory_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateUserSkillsMatrixReport = async () => {
  const users = await fetchUserReportData();
  const pdf = new PDFReportGenerator('landscape');

  pdf.addHeader({
    title: 'User Skills Matrix Report',
    subtitle: 'Comprehensive skills and expertise overview',
  });

  pdf.addSection('User Skills');

  users.forEach(user => {
    if (user.user_skills && user.user_skills.length > 0) {
      pdf.addText(`${user.full_name}`, 11, true);
      const skillsData = user.user_skills.map((skill: any) => ({
        skill: skill.skill_name,
        level: skill.proficiency_level,
      }));
      pdf.addTable(
        [
          { header: 'Skill', dataKey: 'skill' },
          { header: 'Proficiency Level', dataKey: 'level' },
        ],
        skillsData
      );
    }
  });

  pdf.download(`user_skills_matrix_${new Date().toISOString().split('T')[0]}`);
};

export const generateInventoryCatalogReport = async (dateRange?: DateRange) => {
  const items = await fetchInventoryReportData(dateRange);
  const stats = calculateInventoryStats(items);
  const pdf = new PDFReportGenerator('landscape');

  pdf.addHeader({
    title: 'Inventory Catalog Report',
    subtitle: 'Complete inventory listing with details',
    dateRange,
  });

  const summary: SummaryItem[] = [
    { label: 'Total Items', value: stats.totalItems },
    { label: 'Total Quantity', value: stats.totalQuantity },
    { label: 'Low Stock Items', value: stats.lowStockItems },
  ];

  pdf.addSummarySection('Inventory Summary', summary);

  pdf.addSection('Category Breakdown');
  const categoryData = Object.entries(stats.categoryBreakdown).map(([category, count]) => ({
    category,
    count,
  }));
  pdf.addTable(
    [
      { header: 'Category', dataKey: 'category' },
      { header: 'Item Count', dataKey: 'count' },
    ],
    categoryData
  );

  const columns: TableColumn[] = [
    { header: 'Item Name', dataKey: 'item_name' },
    { header: 'Category', dataKey: 'category' },
    { header: 'Serial #', dataKey: 'serial_number' },
    { header: 'Asset Tag', dataKey: 'asset_tag' },
    { header: 'Quantity', dataKey: 'quantity' },
    { header: 'Location', dataKey: 'location' },
    { header: 'Condition', dataKey: 'condition' },
  ];

  pdf.addTable(columns, items, 'Inventory Details');

  pdf.download(`inventory_catalog_${new Date().toISOString().split('T')[0]}`);
};

export const generateInventoryConditionReport = async () => {
  const items = await fetchInventoryReportData();
  const pdf = new PDFReportGenerator('portrait');

  pdf.addHeader({
    title: 'Inventory Condition Assessment Report',
    subtitle: 'Items requiring attention or maintenance',
  });

  const needsAttention = items.filter(
    item => item.condition === 'poor' || item.condition === 'damaged' || item.quantity < 10
  );

  const summary: SummaryItem[] = [
    { label: 'Total Items Reviewed', value: items.length },
    { label: 'Items Needing Attention', value: needsAttention.length },
    { label: 'Damaged Items', value: items.filter(i => i.condition === 'damaged').length },
    { label: 'Poor Condition Items', value: items.filter(i => i.condition === 'poor').length },
  ];

  pdf.addSummarySection('Assessment Summary', summary);

  const columns: TableColumn[] = [
    { header: 'Item Name', dataKey: 'item_name' },
    { header: 'Category', dataKey: 'category' },
    { header: 'Condition', dataKey: 'condition' },
    { header: 'Quantity', dataKey: 'quantity' },
    { header: 'Location', dataKey: 'location' },
    { header: 'Last Maintenance', dataKey: 'last_maintenance_date' },
  ];

  pdf.addTable(columns, needsAttention, 'Items Requiring Attention');

  pdf.download(`inventory_condition_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateProcurementReport = async (dateRange?: DateRange) => {
  const requests = await fetchProcurementReportData(dateRange);
  const stats = calculateProcurementStats(requests);
  const pdf = new PDFReportGenerator('landscape');

  pdf.addHeader({
    title: 'Procurement Summary Report',
    subtitle: 'Purchase requests and procurement status',
    dateRange,
  });

  const summary: SummaryItem[] = [
    { label: 'Total Requests', value: stats.totalRequests },
    { label: 'Total Estimated Cost', value: `$${stats.totalEstimatedCost.toFixed(2)}` },
    { label: 'Approved', value: stats.statusBreakdown['approved'] || 0 },
    { label: 'Pending', value: stats.statusBreakdown['submitted'] || 0 },
    { label: 'Rejected', value: stats.statusBreakdown['rejected'] || 0 },
  ];

  pdf.addSummarySection('Procurement Summary', summary);

  pdf.addSection('Status Breakdown');
  const statusData = Object.entries(stats.statusBreakdown).map(([status, count]) => ({
    status,
    count,
  }));
  pdf.addTable(
    [
      { header: 'Status', dataKey: 'status' },
      { header: 'Count', dataKey: 'count' },
    ],
    statusData
  );

  const columns: TableColumn[] = [
    { header: 'Product Name', dataKey: 'item_name' },
    { header: 'Category', dataKey: 'category' },
    { header: 'Quantity', dataKey: 'quantity' },
    { header: 'Est. Cost', dataKey: 'estimated_cost' },
    { header: 'Status', dataKey: 'status' },
    { header: 'Requested By', dataKey: 'requester_name' },
    { header: 'Request Date', dataKey: 'created_at_formatted' },
  ];

  const tableData = requests.map(req => ({
    ...req,
    requester_name: req.requester?.full_name || 'N/A',
    created_at_formatted: new Date(req.created_at).toLocaleDateString(),
  }));

  pdf.addTable(columns, tableData, 'Purchase Request Details');

  pdf.download(`procurement_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateLeaveAnalyticsReport = async (dateRange?: DateRange) => {
  const leaves = await fetchLeaveReportData(dateRange);
  const stats = calculateLeaveStats(leaves);
  const pdf = new PDFReportGenerator('portrait');

  pdf.addHeader({
    title: 'Leave Analytics Report',
    subtitle: 'Leave requests and utilization analysis',
    dateRange,
  });

  const summary: SummaryItem[] = [
    { label: 'Total Leave Requests', value: stats.totalRequests },
    { label: 'Approved', value: stats.approved },
    { label: 'Rejected', value: stats.rejected },
    { label: 'Pending', value: stats.pending },
    {
      label: 'Approval Rate',
      value: stats.totalRequests > 0 ? `${((stats.approved / stats.totalRequests) * 100).toFixed(1)}%` : '0%',
    },
  ];

  pdf.addSummarySection('Leave Summary', summary);

  pdf.addSection('Leave Type Breakdown');
  const typeData = Object.entries(stats.typeBreakdown).map(([type, count]) => ({
    type,
    count,
  }));
  pdf.addTable(
    [
      { header: 'Leave Type', dataKey: 'type' },
      { header: 'Count', dataKey: 'count' },
    ],
    typeData
  );

  const columns: TableColumn[] = [
    { header: 'Requester', dataKey: 'requester_name' },
    { header: 'Department', dataKey: 'department' },
    { header: 'Leave Type', dataKey: 'leave_type' },
    { header: 'From Date', dataKey: 'from_date' },
    { header: 'To Date', dataKey: 'to_date' },
    { header: 'Status', dataKey: 'status' },
  ];

  const tableData = leaves.map(leave => ({
    ...leave,
    requester_name: leave.requester?.full_name || 'N/A',
    department: leave.requester?.department || 'N/A',
  }));

  pdf.addTable(columns, tableData, 'Leave Request Details');

  pdf.download(`leave_analytics_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateWorkProgressReport = async (dateRange?: DateRange) => {
  const works = await fetchWorkReportData(dateRange);
  const stats = calculateWorkStats(works);
  const pdf = new PDFReportGenerator('landscape');

  pdf.addHeader({
    title: 'Work Progress Report',
    subtitle: 'Assigned work and progress tracking',
    dateRange,
  });

  const summary: SummaryItem[] = [
    { label: 'Total Works', value: stats.totalWorks },
    { label: 'Completed', value: stats.completed },
    { label: 'On Track', value: stats.onTrack },
    { label: 'Needs Attention', value: stats.needsAttention },
    {
      label: 'Completion Rate',
      value: stats.totalWorks > 0 ? `${((stats.completed / stats.totalWorks) * 100).toFixed(1)}%` : '0%',
    },
  ];

  pdf.addSummarySection('Work Summary', summary);

  const columns: TableColumn[] = [
    { header: 'Work Title', dataKey: 'work_title' },
    { header: 'Assigned To', dataKey: 'user_name' },
    { header: 'Project', dataKey: 'project_name' },
    { header: 'Priority', dataKey: 'priority' },
    { header: 'Status', dataKey: 'admin_status' },
    { header: 'Start Date', dataKey: 'start_date' },
    { header: 'End Date', dataKey: 'end_date' },
  ];

  const tableData = works.map(work => ({
    ...work,
    user_name: work.user?.full_name || 'N/A',
  }));

  pdf.addTable(columns, tableData, 'Work Details');

  pdf.download(`work_progress_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateFacilitiesReport = async () => {
  const facilities = await fetchFacilitiesReportData();
  const pdf = new PDFReportGenerator('landscape');

  pdf.addHeader({
    title: 'Facilities and Equipment Report',
    subtitle: 'Complete facilities inventory and assignments',
  });

  const summary: SummaryItem[] = [
    { label: 'Total Facilities', value: facilities.length },
    { label: 'Assigned', value: facilities.filter(f => f.assigned_to_user_id).length },
    { label: 'Available', value: facilities.filter(f => !f.assigned_to_user_id).length },
    { label: 'Working', value: facilities.filter(f => f.status === 'working').length },
    { label: 'Under Maintenance', value: facilities.filter(f => f.status === 'maintenance').length },
  ];

  pdf.addSummarySection('Facilities Summary', summary);

  const columns: TableColumn[] = [
    { header: 'Name', dataKey: 'name' },
    { header: 'Make/Model', dataKey: 'make_model' },
    { header: 'Serial #', dataKey: 'serial_number' },
    { header: 'Location', dataKey: 'location' },
    { header: 'Status', dataKey: 'status' },
    { header: 'Assigned To', dataKey: 'assigned_to_name' },
  ];

  const tableData = facilities.map(facility => ({
    ...facility,
    assigned_to_name: facility.assigned_to?.full_name || 'Unassigned',
  }));

  pdf.addTable(columns, tableData, 'Facility Details');

  pdf.download(`facilities_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateRepositoryReport = async (dateRange?: DateRange) => {
  const documents = await fetchRepositoryReportData(dateRange);
  const pdf = new PDFReportGenerator('portrait');

  pdf.addHeader({
    title: 'Repository Documents Report',
    subtitle: 'Document catalog and usage statistics',
    dateRange,
  });

  const categoryBreakdown = documents.reduce((acc, doc) => {
    acc[doc.category] = (acc[doc.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summary: SummaryItem[] = [
    { label: 'Total Documents', value: documents.length },
    { label: 'Private Documents', value: documents.filter(d => d.visibility === 'private').length },
    { label: 'Shared Documents', value: documents.filter(d => d.visibility === 'shared').length },
  ];

  pdf.addSummarySection('Repository Summary', summary);

  pdf.addSection('Category Breakdown');
  const categoryData = Object.entries(categoryBreakdown).map(([category, count]) => ({
    category,
    count,
  }));
  pdf.addTable(
    [
      { header: 'Category', dataKey: 'category' },
      { header: 'Count', dataKey: 'count' },
    ],
    categoryData
  );

  const columns: TableColumn[] = [
    { header: 'Title', dataKey: 'title' },
    { header: 'Category', dataKey: 'category' },
    { header: 'Uploaded By', dataKey: 'uploader_name' },
    { header: 'Upload Date', dataKey: 'uploaded_at_formatted' },
    { header: 'Visibility', dataKey: 'visibility' },
  ];

  const tableData = documents.map(doc => ({
    ...doc,
    uploader_name: doc.uploader?.full_name || 'N/A',
    uploaded_at_formatted: new Date(doc.uploaded_at).toLocaleDateString(),
  }));

  pdf.addTable(columns, tableData, 'Document Details');

  pdf.download(`repository_report_${new Date().toISOString().split('T')[0]}`);
};

export const generateAuditLogReport = async (dateRange?: DateRange) => {
  const logs = await fetchAuditLogReportData(dateRange);
  const pdf = new PDFReportGenerator('landscape');

  pdf.addHeader({
    title: 'System Audit Log Report',
    subtitle: 'User actions and system changes',
    dateRange,
  });

  const actionBreakdown = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const summary: SummaryItem[] = [
    { label: 'Total Actions', value: logs.length },
    { label: 'Unique Users', value: new Set(logs.map(l => l.performed_by)).size },
  ];

  pdf.addSummarySection('Audit Summary', summary);

  const columns: TableColumn[] = [
    { header: 'Entity Type', dataKey: 'entity_type' },
    { header: 'Action', dataKey: 'action' },
    { header: 'Performed By', dataKey: 'performer_name' },
    { header: 'Date/Time', dataKey: 'performed_at_formatted' },
  ];

  const tableData = logs.map(log => ({
    ...log,
    performer_name: log.performer?.full_name || 'System',
    performed_at_formatted: new Date(log.performed_at).toLocaleString(),
  }));

  pdf.addTable(columns, tableData, 'Audit Log Details');

  pdf.download(`audit_log_report_${new Date().toISOString().split('T')[0]}`);
};
