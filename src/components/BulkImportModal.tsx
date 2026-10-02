import { useState, ChangeEvent, DragEvent } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { extractIndianPhone, validateEmail } from '../utils/userValidation';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedUser {
  name: string;
  email: string;
  phone: string;
  designation: string;
  projectName: string;
  projectCode: string;
  projectStartDate: string;
  projectEndDate: string;
  projectTenure: string;
  staffContractStartDate: string;
  staffContractEndDate: string;
  contractTenure: string;
  projectRoleResponsibility: string;
  projectPiCoordinator: string;
  reportingManager: string;
  currentStatus: string;
  contractStatus: string;
  remarksStaff: string;
  remarksManager: string;
  rollNumber: string;
  employeeId: string;
  department: string;
  program: string;
  supervisor: string;
  skills: string;
  software: string;
  equipment: string;
  tenure: string;
  assignedWork: string;
  error?: string;
}

interface ImportResult {
  success: boolean;
  email: string;
  name: string;
  password?: string;
  isExisting?: boolean;
  note?: string;
  error?: string;
}

export default function BulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'results'>('upload');
  const [isDragging, setIsDragging] = useState(false);

  const sampleHeaders = [
    'S. No.',
    'Full Name',
    'Email',
    'Phone',
    'Designation',
    'Project Name',
    'Project Code',
    'Project Start Date',
    'Project End Date',
    'Project Tenure',
    'Staff Contract Start Date',
    'Staff Contract End Date',
    'Contract Tenure',
    'Project Role / Responsibility',
    'Project PI / Coordinator',
    'Reporting Manager',
    'Current Status',
    'Contract Status',
    'Remarks (Staff)',
    'Remarks(Manager)'
  ];

  const sampleRows = [
    [
      '1',
      'Ankita',
      'ankita9525@gmail.com',
      '7208642398',
      'Project Scientist-I',
      'Multi Level AI based Anaemia screening technology with combination of Non -invasive and minimally invasive devices for extreme POC Settings(HGS_SC)',
      'SRIC/HGS_SC/2026/AUG/928',
      '',
      '',
      '',
      'Aug 1, 2026',
      '28 Oct , 2026',
      '89 dAYS',
      '',
      'Suman Chakraborty',
      'Sohom Banerjee',
      'Active',
      'Active',
      '',
      ''
    ],
    [
      '2',
      'Pulasta',
      'pulasta26t@kgpian.iitkgp.ac.in',
      '8274981078',
      'Principal Project Associate',
      'GC HIV/TB: Nanomaterial-Integrated Microfluidic Membrane- Enhanced Lysis(GME)',
      '',
      '',
      '',
      '',
      '19 Jan, 2026',
      'Sept 30, 2026',
      '9 Month',
      '',
      'Suman Chakraborty',
      'Sohom Banerjee',
      'Active',
      'Active',
      '',
      ''
    ],
    [
      '3',
      'Abhijit Narayan Eshore',
      'eshoreabhijit14@gmail.com',
      '9883741928',
      'Project Research Scientist -II (Non Medical)',
      'From Lab to Bedside; and attend to take the multiplex enteric virus real time PCR Detection Asset, A step Further to Handheld PCR (LVR)',
      'IIT/SRIC/R/LVR/2026/J20190250',
      '',
      '',
      '',
      'April 21, 2026',
      'Oct 14, 2026',
      '6 Month',
      '',
      'Suman Chakraborty',
      'Sohom Banerjee',
      'Active',
      'Active',
      'Project will be end by Oct 14, Next step for this ?',
      ''
    ]
  ];

  const downloadSampleTemplate = (format: 'csv' | 'xlsx') => {
    if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);
      // Set reasonable column widths
      ws['!cols'] = sampleHeaders.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Users');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sc_lab_user_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const csvContent =
        sampleHeaders.join(',') +
        '\n' +
        sampleRows.map((row) => row.map((v) => `"${(v || '').replace(/"/g, '""')}"`).join(',')).join('\n') +
        '\n';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'sc_lab_user_import_template.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseFile(droppedFile);
    }
  };

  const parseFile = async (fileToParse: File) => {
    try {
      const buffer = await fileToParse.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', raw: false, cellDates: false });
      const firstSheetName = wb.SheetNames[0];

      if (!firstSheetName || !wb.Sheets[firstSheetName]) {
        alert('The uploaded file does not contain readable sheets or data.');
        return;
      }

      const rawRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[firstSheetName], {
        header: 1,
        defval: '',
        raw: false,
      });

      if (rawRows.length < 2) {
        alert('File must contain at least a header row and one data row.');
        return;
      }

      const headerRow = rawRows[0] || [];
      const headers = headerRow.map((h: any) =>
        String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      );

      const indexMap: Record<string, number> = {
        name: -1,
        email: -1,
        phone: -1,
        designation: -1,
        projectName: -1,
        projectCode: -1,
        projectStartDate: -1,
        projectEndDate: -1,
        projectTenure: -1,
        staffContractStartDate: -1,
        staffContractEndDate: -1,
        contractTenure: -1,
        projectRoleResponsibility: -1,
        projectPiCoordinator: -1,
        reportingManager: -1,
        currentStatus: -1,
        contractStatus: -1,
        remarksStaff: -1,
        remarksManager: -1,
        rollNumber: -1,
        department: -1,
        program: -1,
        supervisor: -1,
        tenure: -1,
        assignedWork: -1,
        skills: -1,
        software: -1,
      };

      headers.forEach((h, i) => {
        if (!h || h === 'sno' || h === 'srno' || h === 'slno' || h === 'serialno' || h === 's') {
          return;
        }
        if (indexMap.email === -1 && (h.includes('email') || h.includes('mail'))) {
          indexMap.email = i;
        } else if (indexMap.phone === -1 && (h.includes('phone') || h.includes('contact') || h.includes('mobile'))) {
          indexMap.phone = i;
        } else if (indexMap.projectStartDate === -1 && h.includes('project') && h.includes('start')) {
          indexMap.projectStartDate = i;
        } else if (indexMap.projectEndDate === -1 && h.includes('project') && h.includes('end')) {
          indexMap.projectEndDate = i;
        } else if (indexMap.projectTenure === -1 && h.includes('project') && h.includes('tenure')) {
          indexMap.projectTenure = i;
        } else if (
          indexMap.staffContractStartDate === -1 &&
          (h.includes('staffcontractstart') || (h.includes('contract') && h.includes('start')))
        ) {
          indexMap.staffContractStartDate = i;
        } else if (
          indexMap.staffContractEndDate === -1 &&
          (h.includes('staffcontractend') || (h.includes('contract') && h.includes('end')))
        ) {
          indexMap.staffContractEndDate = i;
        } else if (indexMap.contractTenure === -1 && h.includes('contract') && h.includes('tenure')) {
          indexMap.contractTenure = i;
        } else if (
          indexMap.projectRoleResponsibility === -1 &&
          (h.includes('role') || h.includes('responsibility'))
        ) {
          indexMap.projectRoleResponsibility = i;
        } else if (
          indexMap.projectPiCoordinator === -1 &&
          (h.includes('pi') || h.includes('coordinator'))
        ) {
          indexMap.projectPiCoordinator = i;
        } else if (
          indexMap.reportingManager === -1 &&
          (h.includes('reporting') || (h.includes('manager') && !h.includes('role') && !h.includes('remark')))
        ) {
          indexMap.reportingManager = i;
        } else if (indexMap.contractStatus === -1 && h.includes('contract') && h.includes('status')) {
          indexMap.contractStatus = i;
        } else if (
          indexMap.currentStatus === -1 &&
          (h.includes('currentstatus') || (h.includes('status') && !h.includes('contract')))
        ) {
          indexMap.currentStatus = i;
        } else if (h.includes('remark')) {
          if (h.includes('staff')) {
            indexMap.remarksStaff = i;
          } else if (h.includes('manager')) {
            indexMap.remarksManager = i;
          } else if (indexMap.remarksStaff === -1) {
            indexMap.remarksStaff = i;
          }
        } else if (indexMap.projectCode === -1 && h.includes('project') && h.includes('code')) {
          indexMap.projectCode = i;
        } else if (
          indexMap.projectName === -1 &&
          (h.includes('projectname') || (h.includes('project') && !h.includes('start') && !h.includes('end')))
        ) {
          indexMap.projectName = i;
        } else if (indexMap.designation === -1 && (h.includes('designation') || h.includes('desig'))) {
          indexMap.designation = i;
        } else if (
          indexMap.rollNumber === -1 &&
          (h.includes('roll') || h.includes('staffid') || h.includes('employeeid'))
        ) {
          indexMap.rollNumber = i;
        } else if (indexMap.tenure === -1 && h.includes('tenure')) {
          indexMap.tenure = i;
        } else if (indexMap.program === -1 && h.includes('program')) {
          indexMap.program = i;
        } else if (indexMap.assignedWork === -1 && h.includes('work')) {
          indexMap.assignedWork = i;
        } else if (indexMap.skills === -1 && h.includes('skill')) {
          indexMap.skills = i;
        } else if (indexMap.software === -1 && (h.includes('software') || h.includes('equipment'))) {
          indexMap.software = i;
        } else if (indexMap.name === -1 && (h.includes('fullname') || h.includes('name'))) {
          indexMap.name = i;
        }
      });

      const users: ParsedUser[] = [];

      for (let i = 1; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !Array.isArray(row)) continue;

        const getValue = (key: string) => {
          const idx = indexMap[key];
          if (idx === undefined || idx === -1 || idx >= row.length) return '';
          const val = row[idx];
          if (val === null || val === undefined) return '';
          return String(val).trim();
        };

        const name = getValue('name');
        const rawEmail = getValue('email');
        const rawPhone = getValue('phone');
        const designation = getValue('designation');
        const projectName = getValue('projectName');
        const projectCode = getValue('projectCode');
        const projectStartDate = getValue('projectStartDate');
        const projectEndDate = getValue('projectEndDate');
        const projectTenure = getValue('projectTenure');
        const staffContractStartDate = getValue('staffContractStartDate');
        const staffContractEndDate = getValue('staffContractEndDate');
        const contractTenure = getValue('contractTenure');
        const projectRoleResponsibility = getValue('projectRoleResponsibility');
        const projectPiCoordinator = getValue('projectPiCoordinator');
        const reportingManager = getValue('reportingManager');
        const currentStatus = getValue('currentStatus');
        const contractStatus = getValue('contractStatus');
        const remarksStaff = getValue('remarksStaff');
        const remarksManager = getValue('remarksManager');
        const rollNumber = getValue('rollNumber');
        const program = getValue('program') || designation;
        const tenure = getValue('tenure') || contractTenure || projectTenure;
        const assignedWork = getValue('assignedWork');
        const skills = getValue('skills');
        const software = getValue('software');

        // CRITICAL FIX FOR BLANK ROWS / COLUMNS:
        // Filter out phantom rows (lines with only commas, empty cells, or trailing sheet rows).
        // A row is only kept if it has at least one meaningful piece of data.
        const hasMeaningfulData = Boolean(
          name ||
            rawEmail ||
            rawPhone ||
            designation ||
            projectName ||
            projectCode ||
            remarksStaff ||
            remarksManager
        );

        if (!hasMeaningfulData) {
          continue;
        }

        let email = rawEmail;
        let rowError: string | undefined = undefined;

        if (!rawEmail) {
          rowError = 'Missing required field: Email';
        } else {
          const emailValidation = validateEmail(rawEmail);
          if (!emailValidation.isValid) {
            rowError = emailValidation.error;
            email = emailValidation.email;
          } else {
            email = emailValidation.email;
          }
        }

        let phone = '';
        if (rawPhone) {
          const phoneValidation = extractIndianPhone(rawPhone, false);
          if (!phoneValidation.isValid) {
            if (!rowError) {
              rowError = phoneValidation.error;
            }
            phone = rawPhone;
          } else {
            phone = phoneValidation.phone || '';
          }
        }

        const isStudent = rollNumber && (rollNumber.includes('R') || rollNumber.length > 6);

        users.push({
          name: name,
          email,
          phone,
          designation,
          projectName,
          projectCode,
          projectStartDate,
          projectEndDate,
          projectTenure,
          staffContractStartDate,
          staffContractEndDate,
          contractTenure,
          projectRoleResponsibility,
          projectPiCoordinator,
          reportingManager,
          currentStatus,
          contractStatus,
          remarksStaff,
          remarksManager,
          rollNumber: isStudent ? rollNumber : '',
          employeeId: !isStudent ? rollNumber : '',
          department:
            program.includes('PhD') || program.includes('MTech') ? 'Research' : 'Staff',
          program,
          supervisor: reportingManager,
          skills,
          software,
          equipment: '',
          tenure,
          assignedWork,
          error: rowError,
        });
      }

      if (users.length === 0) {
        alert('No valid user data rows found in the file.');
        return;
      }

      setParsedUsers(users);
      setStep('preview');
    } catch (err: any) {
      console.error('File parsing error:', err);
      alert('Failed to parse file: ' + (err.message || 'Please check the file format.'));
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    const results: ImportResult[] = [];

    for (const user of parsedUsers) {
      if (user.error) {
        results.push({
          success: false,
          email: user.email || 'N/A',
          name: user.name || 'Not specified',
          error: user.error,
        });
        continue;
      }

      try {
        let joiningDate = new Date();
        if (user.staffContractStartDate) {
          const d = new Date(user.staffContractStartDate);
          if (!isNaN(d.getTime())) joiningDate = d;
        } else if (user.projectStartDate) {
          const d = new Date(user.projectStartDate);
          if (!isNaN(d.getTime())) joiningDate = d;
        } else if (user.tenure) {
          const yearMatch = user.tenure.match(/\d{4}/);
          if (yearMatch) {
            joiningDate = new Date(yearMatch[0] + '-01-01');
          }
        }

        const { data: result, error: createError } = await api.post(
          '/api/admin/users/bulk-import-single',
          {
            email: user.email,
            full_name: user.name || null,
            phone: user.phone || null,
            designation: user.designation || null,
            program_designation: user.designation || null,
            project_name: user.projectName || null,
            project_code: user.projectCode || null,
            project_start_date: user.projectStartDate || null,
            project_end_date: user.projectEndDate || null,
            project_tenure: user.projectTenure || null,
            staff_contract_start_date: user.staffContractStartDate || null,
            staff_contract_end_date: user.staffContractEndDate || null,
            contract_tenure: user.contractTenure || null,
            project_role_responsibility: user.projectRoleResponsibility || null,
            project_pi_coordinator: user.projectPiCoordinator || null,
            reporting_manager: user.reportingManager || user.supervisor || null,
            supervisor: user.reportingManager || user.supervisor || null,
            current_status: user.currentStatus || null,
            contract_status: user.contractStatus || null,
            remarks_staff: user.remarksStaff || null,
            remarks_manager: user.remarksManager || null,
            roll_number: user.rollNumber || null,
            employee_id: user.employeeId || null,
            department: user.department || null,
            user_role: 'user',
            joining_date: joiningDate.toISOString().split('T')[0],
          }
        );

        if (createError) {
          const errMsg =
            typeof createError === 'string'
              ? createError
              : (createError as any).message || 'Unknown error';
          results.push({
            success: false,
            email: user.email,
            name: user.name || 'Not specified',
            error: errMsg,
          });
          continue;
        }

        const isExistingUser = result.is_existing || false;
        const fieldsUpdated = result.fields_updated || [];
        let noteMsg = 'New account created';
        if (isExistingUser) {
          if (fieldsUpdated.length > 0) {
            noteMsg = `Existing user updated (${fieldsUpdated.length} missing fields filled: ${fieldsUpdated.join(', ')})`;
          } else {
            noteMsg = 'Existing user (all fields already filled; no data overwritten)';
          }
        }

        results.push({
          success: true,
          email: user.email,
          name: result.full_name || user.name || 'New User',
          password: result.password || '',
          isExisting: isExistingUser,
          note: noteMsg,
        });
      } catch (err: any) {
        results.push({
          success: false,
          email: user.email,
          name: user.name || 'Not specified',
          error: err.message || 'Unknown error',
        });
      }
    }

    setImportResults(results);
    setImporting(false);
    setStep('results');
    onImportComplete();
  };

  const downloadCredentials = () => {
    const successfulWithPassword = importResults.filter((r) => r.success && r.password);
    let csv = 'Name,Email,Temporary Password\n';

    successfulWithPassword.forEach((result) => {
      csv += `"${result.name}","${result.email}","${result.password}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-credentials-${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setFile(null);
    setParsedUsers([]);
    setImportResults([]);
    setStep('upload');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Bulk Import Users</h2>
            <p className="text-sm text-gray-500">
              Import lab members with project and contract details via CSV or Excel (.xlsx)
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={importing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div>
              <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex-1">
                  <p className="text-sm text-blue-900 font-semibold mb-1">
                    Upload Format (CSV or Excel)
                  </p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Supported columns: <strong>S. No., Full Name, Email, Phone, Designation, Project Name, Project Code, Project Start/End Date, Project Tenure, Staff Contract Start/End Date, Contract Tenure, Project Role / Responsibility, Project PI / Coordinator, Reporting Manager, Current Status, Contract Status, Remarks (Staff), Remarks(Manager)</strong>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('csv')}
                    className="inline-flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-white border border-blue-300 hover:bg-blue-100/60 px-3 py-2 rounded-lg transition"
                    title="Download template as CSV"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                    <span>Sample CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSampleTemplate('xlsx')}
                    className="inline-flex items-center space-x-2 text-xs font-semibold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-100/60 px-3 py-2 rounded-lg transition"
                    title="Download template as Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Sample Excel (.xlsx)</span>
                  </button>
                </div>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition cursor-pointer ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-gray-300 hover:border-blue-500 bg-white'
                }`}
              >
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, .xlsx, .xls"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer block">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Click to upload CSV or Excel (.xlsx) file
                  </p>
                  <p className="text-sm text-gray-500">
                    or drag and drop your spreadsheet here (.csv, .xlsx, .xls)
                  </p>
                </label>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    Selected file: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Preview: {parsedUsers.length} Users Detected
                  </h3>
                  <p className="text-xs text-gray-500">
                    Blank rows have been filtered out. Review mapped data before finalizing import.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="inline-flex items-center text-emerald-700 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    {parsedUsers.filter((u) => !u.error).length} Valid
                  </span>
                  {parsedUsers.some((u) => u.error) && (
                    <span className="inline-flex items-center text-red-600 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-500" />
                      {parsedUsers.filter((u) => u.error).length} Require Attention
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-96 overflow-x-auto overflow-y-auto border border-gray-200 rounded-lg shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-100/80 sticky top-0 font-semibold text-gray-700 uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2.5 w-10 text-center">#</th>
                      <th className="px-3 py-2.5 min-w-[140px]">Full Name</th>
                      <th className="px-3 py-2.5 min-w-[180px]">Email</th>
                      <th className="px-3 py-2.5 min-w-[110px]">Phone</th>
                      <th className="px-3 py-2.5 min-w-[150px]">Designation</th>
                      <th className="px-3 py-2.5 min-w-[200px]">Project</th>
                      <th className="px-3 py-2.5 min-w-[140px]">Manager / PI</th>
                      <th className="px-3 py-2.5 min-w-[110px]">Contract Dates</th>
                      <th className="px-3 py-2.5 min-w-[100px]">Status</th>
                      <th className="px-3 py-2.5 min-w-[150px]">Remarks</th>
                      <th className="px-3 py-2.5 min-w-[120px]">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {parsedUsers.map((user, idx) => {
                      const hasMissingFields =
                        !user.name ||
                        !user.designation ||
                        !user.projectName ||
                        !user.staffContractStartDate ||
                        !user.staffContractEndDate ||
                        !user.reportingManager ||
                        !user.currentStatus ||
                        !user.contractStatus;

                      return (
                        <tr
                          key={idx}
                          className={user.error ? 'bg-red-50/60' : 'hover:bg-gray-50/80'}
                        >
                          <td className="px-3 py-2 text-center text-gray-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {user.name || (
                              <span className="text-gray-400 italic font-normal">
                                Pending first login
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {user.email || (
                              <span className="text-red-500 font-medium">Missing Email</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{user.phone || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{user.designation || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">
                            {user.projectName ? (
                              <div>
                                <span className="font-medium text-gray-800 line-clamp-2" title={user.projectName}>
                                  {user.projectName}
                                </span>
                                {user.projectCode && (
                                  <span className="text-[11px] text-gray-400 block font-mono mt-0.5">
                                    {user.projectCode}
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {user.reportingManager || user.projectPiCoordinator || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {user.staffContractStartDate || user.staffContractEndDate ? (
                              <div>
                                <span>{user.staffContractStartDate || '—'}</span>
                                <span className="text-gray-400 mx-1">to</span>
                                <span>{user.staffContractEndDate || '—'}</span>
                                {user.contractTenure && (
                                  <span className="text-[11px] text-gray-400 block">
                                    ({user.contractTenure})
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {user.currentStatus ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700">
                                {user.currentStatus}
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700">
                                Pending login
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 max-w-[200px]">
                            {user.remarksStaff || user.remarksManager ? (
                              <div className="space-y-0.5">
                                {user.remarksStaff && (
                                  <p className="text-[11px] text-gray-700 truncate" title={`Staff: ${user.remarksStaff}`}>
                                    <span className="font-semibold text-gray-500">Staff: </span>{user.remarksStaff}
                                  </p>
                                )}
                                {user.remarksManager && (
                                  <p className="text-[11px] text-gray-700 truncate" title={`Manager: ${user.remarksManager}`}>
                                    <span className="font-semibold text-gray-500">Mgr: </span>{user.remarksManager}
                                  </p>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {user.error ? (
                              <span className="inline-flex items-center text-red-600 text-[11px] font-medium" title={user.error}>
                                <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />
                                <span className="truncate max-w-[120px]">{user.error}</span>
                              </span>
                            ) : hasMissingFields ? (
                              <span
                                className="inline-flex items-center text-amber-600 text-[11px] font-medium"
                                title="User will complete remaining mandatory fields on first login"
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-amber-500 shrink-0" />
                                Ready (Partial)
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-emerald-600 text-[11px] font-medium">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-500 shrink-0" />
                                Ready (Full)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={parsedUsers.filter((u) => !u.error).length === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition disabled:bg-gray-300 disabled:cursor-not-allowed shadow-sm"
                >
                  Import {parsedUsers.filter((u) => !u.error).length} Users
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Importing Users...</h3>
              <p className="text-gray-600">
                Please wait while accounts are created or existing missing data is populated.
              </p>
            </div>
          )}

          {step === 'results' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Import Complete</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wider mb-1">
                      New Accounts Created
                    </p>
                    <p className="text-2xl font-bold text-emerald-800">
                      {importResults.filter((r) => r.success && !r.isExisting).length}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1">Temporary password generated</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider mb-1">
                      Existing Users Updated
                    </p>
                    <p className="text-2xl font-bold text-blue-800">
                      {importResults.filter((r) => r.success && r.isExisting).length}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Missing fields filled; password untouched
                    </p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-xs text-red-700 font-semibold uppercase tracking-wider mb-1">
                      Failed
                    </p>
                    <p className="text-2xl font-bold text-red-800">
                      {importResults.filter((r) => !r.success).length}
                    </p>
                    <p className="text-xs text-red-600 mt-1">Errors listed below</p>
                  </div>
                </div>
              </div>

              {importResults.filter((r) => r.success && r.password).length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-900">Download User Credentials</p>
                      <p className="text-xs text-blue-700">
                        CSV includes temporary passwords for{' '}
                        {importResults.filter((r) => r.success && r.password).length} newly created accounts.
                        (Existing users retain their existing passwords).
                      </p>
                    </div>
                    <button
                      onClick={downloadCredentials}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg mb-6">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Email</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">Notes / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {importResults.map((result, idx) => (
                      <tr key={idx} className={result.success ? '' : 'bg-red-50'}>
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{result.name}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{result.email}</td>
                        <td className="px-4 py-2.5 text-sm">
                          {result.success ? (
                            result.isExisting ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-blue-600" />
                                Existing User
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                New Account
                              </span>
                            )
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-600" />
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">
                          {result.error ? (
                            <span className="text-red-600 font-medium">{result.error}</span>
                          ) : (
                            <span>{result.note}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
