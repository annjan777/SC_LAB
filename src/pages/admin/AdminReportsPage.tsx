import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  FileText,
  Users,
  Package,
  ShoppingCart,
  Calendar,
  Briefcase,
  Building2,
  FolderOpen,
  Shield,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import { PageHeader, Button, Card, EmptyState } from '../../components/ui';
import {
  generateUserDirectoryReport,
  generateUserSkillsMatrixReport,
  generateInventoryCatalogReport,
  generateInventoryConditionReport,
  generateInventoryRequestsReport,
  generateConsumablesDeductionReport,
  generateEquipmentLoansReport,
  generateEquipmentReturnsReport,
  generateFacilityEquipmentReport,
  generateProcurementReport,
  generateLeaveAnalyticsReport,
  generateWorkProgressReport,
  generateFacilitiesReport,
  generateRepositoryReport,
  generateAuditLogReport,
} from '../../utils/reportGenerators';
import { DateRange } from '../../utils/reportData';

interface ReportCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  category: 'users' | 'inventory' | 'procurement' | 'leave' | 'work' | 'facilities' | 'repository' | 'system';
  supportsDateRange: boolean;
  action: (dateRange?: DateRange) => Promise<void>;
}

export default function AdminReportsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const reports: ReportCard[] = [
    {
      id: 'user-directory',
      title: 'User Directory Report',
      description: 'Complete list of lab members with contact information and roles',
      icon: Users,
      category: 'users',
      supportsDateRange: true,
      action: generateUserDirectoryReport,
    },
    {
      id: 'user-skills',
      title: 'User Skills Matrix',
      description: 'Comprehensive skills and expertise overview across all users',
      icon: Users,
      category: 'users',
      supportsDateRange: false,
      action: generateUserSkillsMatrixReport,
    },
    {
      id: 'inventory-catalog',
      title: 'Inventory Catalog',
      description: 'Complete inventory listing with classification, locations, and vendors',
      icon: Package,
      category: 'inventory',
      supportsDateRange: true,
      action: generateInventoryCatalogReport,
    },
    {
      id: 'inventory-requests',
      title: 'Inventory Requests & Transactions',
      description: 'Complete transaction history of all requests, approvals, issues, and loan statuses',
      icon: Package,
      category: 'inventory',
      supportsDateRange: true,
      action: generateInventoryRequestsReport,
    },
    {
      id: 'inventory-consumables',
      title: 'Consumables & Stock Deductions',
      description: 'Chemicals and materials issued with quantity-based stock deduction records',
      icon: Package,
      category: 'inventory',
      supportsDateRange: true,
      action: generateConsumablesDeductionReport,
    },
    {
      id: 'inventory-equipment',
      title: 'Equipment Assignments & Active Loans',
      description: 'Assigned equipment, active loans, return dates, and overdue items',
      icon: Package,
      category: 'inventory',
      supportsDateRange: true,
      action: generateEquipmentLoansReport,
    },
    {
      id: 'inventory-returns',
      title: 'Equipment Returns & Condition Log',
      description: 'Return history, physical condition at return, and inspection remarks',
      icon: Package,
      category: 'inventory',
      supportsDateRange: true,
      action: generateEquipmentReturnsReport,
    },
    {
      id: 'facility-equipment',
      title: 'Facility-wise Equipment Mapping',
      description: 'Equipment associated with facilities including project codes and funding sources',
      icon: Building2,
      category: 'facilities',
      supportsDateRange: false,
      action: generateFacilityEquipmentReport,
    },
    {
      id: 'inventory-condition',
      title: 'Inventory Condition Assessment',
      description: 'Items requiring attention, maintenance, or replacement',
      icon: Package,
      category: 'inventory',
      supportsDateRange: false,
      action: generateInventoryConditionReport,
    },
    {
      id: 'procurement-summary',
      title: 'Procurement Summary',
      description: 'Purchase requests, approvals, and spending analysis',
      icon: ShoppingCart,
      category: 'procurement',
      supportsDateRange: true,
      action: generateProcurementReport,
    },
    {
      id: 'leave-analytics',
      title: 'Leave Analytics Report',
      description: 'Leave requests, utilization patterns, and approval rates',
      icon: Calendar,
      category: 'leave',
      supportsDateRange: true,
      action: generateLeaveAnalyticsReport,
    },
    {
      id: 'work-progress',
      title: 'Work Progress Report',
      description: 'Assigned work status, completion rates, and milestones',
      icon: Briefcase,
      category: 'work',
      supportsDateRange: true,
      action: generateWorkProgressReport,
    },
    {
      id: 'facilities-report',
      title: 'Facilities and Equipment',
      description: 'Complete facilities inventory, assignments, and maintenance',
      icon: Building2,
      category: 'facilities',
      supportsDateRange: false,
      action: generateFacilitiesReport,
    },
    {
      id: 'repository-report',
      title: 'Repository Documents',
      description: 'Document catalog, uploads, and usage statistics',
      icon: FolderOpen,
      category: 'repository',
      supportsDateRange: true,
      action: generateRepositoryReport,
    },
    {
      id: 'audit-log',
      title: 'System Audit Log',
      description: 'User actions, system changes, and activity tracking',
      icon: Shield,
      category: 'system',
      supportsDateRange: true,
      action: generateAuditLogReport,
    },
  ];

  const categories = [
    { id: 'all', label: 'All Reports', count: reports.length },
    { id: 'users', label: 'User Reports', count: reports.filter(r => r.category === 'users').length },
    { id: 'inventory', label: 'Inventory Reports', count: reports.filter(r => r.category === 'inventory').length },
    { id: 'procurement', label: 'Procurement Reports', count: reports.filter(r => r.category === 'procurement').length },
    { id: 'leave', label: 'Leave Reports', count: reports.filter(r => r.category === 'leave').length },
    { id: 'work', label: 'Work Reports', count: reports.filter(r => r.category === 'work').length },
    { id: 'facilities', label: 'Facilities Reports', count: reports.filter(r => r.category === 'facilities').length },
    { id: 'repository', label: 'Repository Reports', count: reports.filter(r => r.category === 'repository').length },
    { id: 'system', label: 'System Reports', count: reports.filter(r => r.category === 'system').length },
  ];

  const handleGenerateReport = async (report: ReportCard) => {
    setLoading(report.id);
    setError('');
    setSuccess('');

    try {
      if (report.supportsDateRange && dateRange) {
        await report.action(dateRange);
      } else {
        await report.action();
      }
      setSuccess(`${report.title} generated successfully!`);
    } catch (err: any) {
      console.error('Report generation error:', err);
      setError(`Failed to generate report: ${err.message}`);
    } finally {
      setLoading(null);
    }
  };

  const filteredReports = selectedCategory === 'all'
    ? reports
    : reports.filter(r => r.category === selectedCategory);

  const { hasPermission } = useAuth();
  if (!hasPermission('view_reports')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader title="Advanced Reports" />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <DateRangeFilter
            onApply={setDateRange}
            label="Date Range Filter"
          />

          <Card className="p-4">
            <h3 className="sc-card-title mb-3">Categories</h3>
            <div className="space-y-1">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{category.label}</span>
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                      {category.count}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Quick Tips</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Use date range filter for time-based reports</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Reports are downloaded as PDF files</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>All data is current and real-time</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReports.map((report) => {
              const Icon = report.icon;
              const isGenerating = loading === report.id;
              const requiresDateRange = report.supportsDateRange && dateRange;

              return (
                <Card
                  key={report.id}
                  hover
                  className="p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Icon className="h-6 w-6" />
                      </div>
                      {report.supportsDateRange && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                          Date Range
                        </span>
                      )}
                    </div>

                    <h3 className="sc-card-title mb-2">
                      {report.title}
                    </h3>
                    <p className="sc-muted text-sm mb-4 min-h-[40px]">
                      {report.description}
                    </p>
                  </div>

                  <div>
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => handleGenerateReport(report)}
                      isLoading={isGenerating}
                      leftIcon={!isGenerating ? <Download className="w-4 h-4" /> : undefined}
                    >
                      {isGenerating ? 'Generating...' : 'Generate Report'}
                    </Button>

                    {report.supportsDateRange && requiresDateRange && (
                      <p className="text-xs text-green-600 mt-2 text-center">
                        Using custom date range
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {filteredReports.length === 0 && (
            <Card className="p-12">
              <EmptyState
                icon={FileText}
                title="No Reports Found"
                description="No reports match the selected category."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
