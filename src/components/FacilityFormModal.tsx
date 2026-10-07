import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { X, Upload, Image as ImageIcon, Loader } from 'lucide-react';

interface FacilityFormModalProps {
  facility: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

const formatSpecs = (specs: any) => {
  if (!specs) return '';
  if (typeof specs === 'string') return specs;
  if (typeof specs === 'object' && Object.keys(specs).length === 1 && specs.details) return specs.details;
  return JSON.stringify(specs, null, 2);
};

export default function FacilityFormModal({ facility, onClose, onSuccess }: FacilityFormModalProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(facility?.image_url || null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: facility?.name || '',
    make_model: facility?.make_model || facility?.model_number || '',
    specifications: formatSpecs(facility?.specifications),
    serial_number: facility?.serial_number || '',
    asset_tag: facility?.asset_tag || '',
    location: facility?.location || '',
    capacity: facility?.capacity ? String(facility.capacity) : '',
    features: Array.isArray(facility?.features) ? facility.features.join(', ') : (facility?.features || ''),
    status: facility?.status || 'operational',
    assigned_to_user_id: facility?.assigned_to_user_id || facility?.responsible_person_id || '',
    warranty_end_date: facility?.warranty_end_date ? String(facility.warranty_end_date).split('T')[0] : '',
    last_maintenance_date: facility?.last_maintenance_date ? String(facility.last_maintenance_date).split('T')[0] : '',
    user_manual_url: facility?.user_manual_url || '',
    vendor_name: facility?.vendor_name || facility?.manufacturer || '',
    vendor_contact: facility?.vendor_contact || '',
    project_code: facility?.project_code || '',
    funded_by: facility?.funded_by || '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await api.get('/api/users', { order: 'full_name' });
    if (data) {
      setUsers(Array.isArray(data) ? data : []);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Facility name is required');
      return;
    }
    if (!formData.location.trim()) {
      alert('Location is required');
      return;
    }

    setSubmitting(true);

    try {
      // Build form data with image if provided
      const submitFormData = new FormData();
      submitFormData.append('name', formData.name.trim());
      submitFormData.append('location', formData.location.trim());
      submitFormData.append('capacity', formData.capacity ? String(formData.capacity) : '');
      submitFormData.append('features', formData.features || '');
      submitFormData.append('make_model', formData.make_model || '');
      
      let finalSpecs = formData.specifications;
      if (finalSpecs && finalSpecs.trim()) {
        try {
          JSON.parse(finalSpecs);
        } catch (e) {
          finalSpecs = JSON.stringify({ details: finalSpecs });
        }
        submitFormData.append('specifications', finalSpecs);
      } else {
        submitFormData.append('specifications', JSON.stringify({}));
      }
      
      submitFormData.append('serial_number', formData.serial_number || '');
      submitFormData.append('asset_tag', formData.asset_tag || '');
      submitFormData.append('status', formData.status);
      submitFormData.append('assigned_to_user_id', formData.assigned_to_user_id || '');
      submitFormData.append('warranty_end_date', formData.warranty_end_date || '');
      submitFormData.append('last_maintenance_date', formData.last_maintenance_date || '');
      submitFormData.append('user_manual_url', formData.user_manual_url || '');
      submitFormData.append('vendor_name', formData.vendor_name || '');
      submitFormData.append('vendor_contact', formData.vendor_contact || '');
      submitFormData.append('project_code', formData.project_code || '');
      submitFormData.append('funded_by', formData.funded_by || '');
      if (imageFile) submitFormData.append('image', imageFile);

      if (facility) {
        const { error } = await api.upload('/api/facilities/' + facility.id, submitFormData, 'PUT');
        if (error) throw new Error(typeof error === 'string' ? error : (error as any).message || 'Failed to update facility');
      } else {
        const { error } = await api.upload('/api/facilities', submitFormData);
        if (error) throw new Error(typeof error === 'string' ? error : (error as any).message || 'Failed to create facility');
      }

      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to save facility');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
            {facility ? 'Edit Facility' : 'Add New Facility'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Facility Image</h3>
              <div className="flex items-center space-x-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-lg object-cover border-2 border-gray-300 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-gray-200 dark:bg-slate-800 flex items-center justify-center border border-gray-300 dark:border-slate-700">
                    <ImageIcon className="w-12 h-12 text-gray-400 dark:text-slate-500" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <div className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 transition text-sm font-medium">
                      <Upload className="w-4 h-4 mr-2 text-gray-500 dark:text-slate-400" />
                      <span>Choose Image</span>
                    </div>
                  </label>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                    Max size: 5MB. Supported formats: JPG, PNG, WebP
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fac-field-1" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Facility Name <span className="text-red-500">*</span>
                  </label>
                  <input id="fac-field-1"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="fac-field-2" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Make and Model
                  </label>
                  <input id="fac-field-2"
                    type="text"
                    value={formData.make_model}
                    onChange={(e) => setFormData({ ...formData, make_model: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label htmlFor="fac-field-3" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Specifications
                </label>
                <textarea id="fac-field-3"
                  value={formData.specifications}
                  onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Technical specifications and details..."
                />
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Identification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fac-field-4" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Serial Number
                  </label>
                  <input id="fac-field-4"
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="fac-field-5" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Asset Tag
                  </label>
                  <input id="fac-field-5"
                    type="text"
                    value={formData.asset_tag}
                    onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Project & Funding</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fac-field-6" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Project Code
                  </label>
                  <input id="fac-field-6"
                    type="text"
                    value={formData.project_code}
                    onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                    placeholder="e.g. PRJ-2026-001"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="fac-field-7" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Funded By
                  </label>
                  <input id="fac-field-7"
                    type="text"
                    value={formData.funded_by}
                    onChange={(e) => setFormData({ ...formData, funded_by: e.target.value })}
                    placeholder="e.g. DST-SERB, Institute Grant"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Location and Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fac-field-8" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Location <span className="text-red-500">*</span>
                  </label>
                  <input id="fac-field-8"
                    type="text"
                    required
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="Building, Room, etc."
                  />
                </div>

                <div>
                  <label htmlFor="fac-field-9" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Current Status <span className="text-red-500">*</span>
                  </label>
                  <select id="fac-field-9"
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="operational">Operational</option>
                    <option value="under_maintenance">Under Maintenance</option>
                    <option value="out_of_order">Out of Order</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Capacity & Facilities / Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="fac-field-10" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Capacity (Persons / Seats)
                  </label>
                  <input id="fac-field-10"
                    type="number"
                    min="1"
                    placeholder="e.g. 25"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="fac-field-11" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Features & Amenities (Comma-separated)
                  </label>
                  <input id="fac-field-11"
                    type="text"
                    placeholder="e.g. Projector, Video Conferencing, High Voltage Power, Soldering Stations"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Separate multiple features with commas. They will be displayed as badge tags.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Assignment</h3>
              <div>
                <label htmlFor="fac-field-12" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Managed By
                </label>
                <select id="fac-field-12"
                  value={formData.assigned_to_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Unassigned</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Vendor Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fac-field-13" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Vendor Name
                  </label>
                  <input id="fac-field-13"
                    type="text"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="fac-field-14" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Vendor Contact Number
                  </label>
                  <input id="fac-field-14"
                    type="text"
                    value={formData.vendor_contact}
                    onChange={(e) => setFormData({ ...formData, vendor_contact: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Maintenance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fac-field-15" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Warranty Expiry Date
                  </label>
                  <input id="fac-field-15"
                    type="date"
                    value={formData.warranty_end_date}
                    onChange={(e) => setFormData({ ...formData, warranty_end_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="fac-field-16" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Last Maintenance Date
                  </label>
                  <input id="fac-field-16"
                    type="date"
                    value={formData.last_maintenance_date}
                    onChange={(e) => setFormData({ ...formData, last_maintenance_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-700/60 p-4 rounded-xl">
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Documentation</h3>
              <div>
                <label htmlFor="fac-field-17" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  User Manual URL
                </label>
                <input id="fac-field-17"
                  type="url"
                  value={formData.user_manual_url}
                  onChange={(e) => setFormData({ ...formData, user_manual_url: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="https://example.com/manual.pdf"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-750 transition text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-medium shadow-sm"
            >
              {(submitting || uploading) && <Loader className="w-4 h-4 mr-2 animate-spin" />}
              {facility ? 'Update Facility' : 'Add Facility'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
