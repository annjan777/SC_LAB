import { useState, ChangeEvent } from 'react';
import { X, Upload, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { api } from '../lib/api';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface ParsedUser {
  name: string;
  email: string;
  phone: string;
  program: string;
  designation: string;
  rollNumber: string;
  employeeId: string;
  department: string;
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

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const sanitizePhone = (phone: string): string => {
    if (!phone) return '';
    let clean = phone.replace(/[^0-9+]/g, '');
    if (clean.length === 10 && !clean.startsWith('+')) {
      clean = '+91' + clean;
    }
    if (clean.startsWith('+91') && clean.length === 13) {
      return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`;
    }
    return phone.trim();
  };

  const parseFile = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      alert('File must contain at least a header row and one data row');
      return;
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
    const indexMap: Record<string, number> = {
      name: -1, email: -1, phone: -1, program: -1, designation: -1,
      rollNumber: -1, tenure: -1, assignedWork: -1, skills: -1, software: -1
    };

    headers.forEach((h, i) => {
      if (indexMap.email === -1 && h.includes('email')) indexMap.email = i;
      else if (indexMap.phone === -1 && (h.includes('phone') || h.includes('contact') || h.includes('mobile'))) indexMap.phone = i;
      else if (indexMap.program === -1 && (h.includes('program') || h.includes('project'))) indexMap.program = i;
      else if (indexMap.designation === -1 && (h.includes('designation') || h.includes('role'))) indexMap.designation = i;
      else if (indexMap.rollNumber === -1 && (h.includes('roll') || h.includes('staffid') || h.includes('id'))) indexMap.rollNumber = i;
      else if (indexMap.tenure === -1 && h.includes('tenure')) indexMap.tenure = i;
      else if (indexMap.assignedWork === -1 && h.includes('work')) indexMap.assignedWork = i;
      else if (indexMap.skills === -1 && h.includes('skill')) indexMap.skills = i;
      else if (indexMap.software === -1 && (h.includes('software') || h.includes('equipment'))) indexMap.software = i;
      else if (indexMap.name === -1 && h.includes('name')) indexMap.name = i;
    });

    const users: ParsedUser[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 3) continue;

      const getValue = (key: string) => indexMap[key] !== -1 ? values[indexMap[key]]?.trim() || '' : '';

      const name = getValue('name');
      const email = getValue('email');
      const phone = sanitizePhone(getValue('phone'));
      const program = getValue('program');
      const designation = getValue('designation');
      const rollNumber = getValue('rollNumber');
      const tenure = getValue('tenure');
      const assignedWork = getValue('assignedWork');
      const skills = getValue('skills');
      const software = getValue('software');

      if (!name || !email) {
        users.push({
          name,
          email,
          phone,
          program,
          designation,
          rollNumber,
          employeeId: '',
          department: '',
          supervisor: '',
          skills,
          software,
          equipment: '',
          tenure,
          assignedWork,
          error: 'Missing required fields (name or email)',
        });
        continue;
      }

      const isStudent = rollNumber && (rollNumber.includes('R') || rollNumber.length > 6);

      users.push({
        name,
        email,
        phone,
        program,
        designation,
        rollNumber: isStudent ? rollNumber : '',
        employeeId: !isStudent ? rollNumber : '',
        department: program.includes('PhD') || program.includes('MTech') ? 'Research' : 'Staff',
        supervisor: '',
        skills,
        software,
        equipment: '',
        tenure,
        assignedWork,
      });
    }

    setParsedUsers(users);
    setStep('preview');
  };

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    const results: ImportResult[] = [];

    for (const user of parsedUsers) {
      if (user.error) {
        results.push({
          success: false,
          email: user.email,
          name: user.name,
          error: user.error,
        });
        continue;
      }

      try {
        let joiningDate = new Date();
        if (user.tenure) {
          const yearMatch = user.tenure.match(/\d{4}/);
          if (yearMatch) {
            joiningDate = new Date(yearMatch[0] + '-01-01');
          }
        }

        const { data: result, error: createError } = await api.post('/api/admin/users/bulk-import-single', {
          email: user.email,
          full_name: user.name,
          phone: user.phone || null,
          roll_number: user.rollNumber || null,
          employee_id: user.employeeId || null,
          department: user.department || null,
          program_designation: user.designation || null,
          supervisor: user.supervisor || null,
          user_role: 'user',
          joining_date: joiningDate.toISOString().split('T')[0],
        });

        if (createError) {
          const errMsg = typeof createError === 'string' ? createError : (createError as any).message || 'Unknown error';
          if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
            results.push({
              success: false,
              email: user.email,
              name: user.name,
              error: 'Email already exists',
            });
            continue;
          }
          throw new Error(errMsg);
        }

        results.push({
          success: true,
          email: user.email,
          name: user.name,
          password: result.password || '',
        });
      } catch (err: any) {
        results.push({
          success: false,
          email: user.email,
          name: user.name,
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
    const successfulResults = importResults.filter((r) => r.success);
    let csv = 'Name,Email,Temporary Password\n';

    successfulResults.forEach((result) => {
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
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Import Users</h2>
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
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Upload a CSV file with user information. The file should include columns for:
                  Name, Contact No., Email, Programme/Project, Designation, Roll No./Staff ID, etc.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Required columns:</strong> Name, Email
                    <br />
                    <strong>Optional columns:</strong> Contact No., Programme/Project Name,
                    Designation, Roll No./Staff ID, Tenure, Assigned Work, Specific Skillset,
                    Software/Equipment
                  </p>
                </div>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    Click to upload CSV file
                  </p>
                  <p className="text-sm text-gray-500">or drag and drop</p>
                </label>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    Selected file: <strong>{file.name}</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Preview: {parsedUsers.length} users found
                </h3>
                <p className="text-gray-600">Review the parsed data before importing</p>
              </div>

              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Email
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Phone
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Designation
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parsedUsers.map((user, idx) => (
                      <tr key={idx} className={user.error ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-sm">{user.name}</td>
                        <td className="px-4 py-2 text-sm">{user.email}</td>
                        <td className="px-4 py-2 text-sm">{user.phone}</td>
                        <td className="px-4 py-2 text-sm">{user.designation}</td>
                        <td className="px-4 py-2 text-sm">
                          {user.error ? (
                            <span className="text-red-600 text-xs">{user.error}</span>
                          ) : (
                            <span className="text-green-600 text-xs">Ready</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
              <p className="text-gray-600">Please wait while we create user accounts</p>
            </div>
          )}

          {step === 'results' && (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Complete</h3>
                <div className="flex gap-4">
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>{importResults.filter((r) => r.success).length}</strong> users
                      created successfully
                    </p>
                  </div>
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">
                      <strong>{importResults.filter((r) => !r.success).length}</strong> failed
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg mb-6">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Email
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {importResults.map((result, idx) => (
                      <tr key={idx} className={result.success ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-4 py-2">
                          {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">{result.name}</td>
                        <td className="px-4 py-2 text-sm">{result.email}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {result.success ? 'Account created' : result.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> Download the credentials file and share it securely
                  with the users. Passwords cannot be recovered later.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={downloadCredentials}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download Credentials
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
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
