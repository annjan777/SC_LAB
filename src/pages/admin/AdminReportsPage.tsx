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
import {
  generateUserDirectoryReport,
  generateUserSkillsMatrixReport,
  generateInventoryCatalogReport,
  generateInventoryConditionReport,
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
      description: 'Complete inventory listing with quantities and locations',
      icon: Package,
      category: 'inventory',
      supportsDateRange: true,
      action: generateInventoryCatalogReport,
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Advanced Reports</h1>
        <p className="text-gray-600 mt-2">Generate comprehensive reports and export as PDF documents</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <DateRangeFilter
            onApply={setDateRange}
            label="Date Range Filter"
          />

          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
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
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                <div
                  key={report.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    {report.supportsDateRange && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        Date Range
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {report.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 min-h-[40px]">
                    {report.description}
                  </p>

                  <button
                    onClick={() => handleGenerateReport(report)}
                    disabled={isGenerating}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Generate Report
                      </>
                    )}
                  </button>

                  {report.supportsDateRange && requiresDateRange && (
                    <p className="text-xs text-green-600 mt-2 text-center">
                      Using custom date range
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {filteredReports.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Reports Found</h3>
              <p className="text-gray-600">
                No reports match the selected category.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
