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
    make_model: facility?.make_model || '',
    specifications: formatSpecs(facility?.specifications),
    serial_number: facility?.serial_number || '',
    asset_tag: facility?.asset_tag || '',
    location: facility?.location || '',
    status: facility?.status || 'operational',
    assigned_to_user_id: facility?.assigned_to_user_id || '',
    warranty_end_date: facility?.warranty_end_date || '',
    last_maintenance_date: facility?.last_maintenance_date || '',
    user_manual_url: facility?.user_manual_url || '',
    vendor_name: facility?.vendor_name || '',
    vendor_contact: facility?.vendor_contact || '',
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
    setSubmitting(true);

    try {
      // Build form data with image if provided
      const submitFormData = new FormData();
      submitFormData.append('name', formData.name);
      if (formData.make_model) submitFormData.append('make_model', formData.make_model);
      
      let finalSpecs = formData.specifications;
      if (finalSpecs) {
        try {
          JSON.parse(finalSpecs);
        } catch (e) {
          finalSpecs = JSON.stringify({ details: finalSpecs });
        }
        submitFormData.append('specifications', finalSpecs);
      }
      
      if (formData.serial_number) submitFormData.append('serial_number', formData.serial_number);
      if (formData.asset_tag) submitFormData.append('asset_tag', formData.asset_tag);
      if (formData.location) submitFormData.append('location', formData.location);
      submitFormData.append('status', formData.status);
      if (formData.assigned_to_user_id) submitFormData.append('assigned_to_user_id', formData.assigned_to_user_id);
      if (formData.warranty_end_date) submitFormData.append('warranty_end_date', formData.warranty_end_date);
      if (formData.last_maintenance_date) submitFormData.append('last_maintenance_date', formData.last_maintenance_date);
      if (formData.user_manual_url) submitFormData.append('user_manual_url', formData.user_manual_url);
      if (formData.vendor_name) submitFormData.append('vendor_name', formData.vendor_name);
      if (formData.vendor_contact) submitFormData.append('vendor_contact', formData.vendor_contact);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {facility ? 'Edit Facility' : 'Add New Facility'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Facility Image</h3>
              <div className="flex items-center space-x-4">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 rounded-lg object-cover border-2 border-gray-300"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
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
                    <div className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <Upload className="w-5 h-5 mr-2 text-gray-600" />
                      <span className="text-gray-700">Choose Image</span>
                    </div>
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Max size: 5MB. Supported formats: JPG, PNG, WebP
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facility Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Make and Model
                  </label>
                  <input
                    type="text"
                    value={formData.make_model}
                    onChange={(e) => setFormData({ ...formData, make_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specifications
                </label>
                <textarea
                  value={formData.specifications}
                  onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Technical specifications and details..."
                />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Identification</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset Tag
                  </label>
                  <input
                    type="text"
                    value={formData.asset_tag}
                    onChange={(e) => setFormData({ ...formData, asset_tag: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Location and Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Building, Room, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="operational">Operational</option>
                    <option value="under_maintenance">Under Maintenance</option>
                    <option value="out_of_order">Out of Order</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Managed By
                </label>
                <select
                  value={formData.assigned_to_user_id}
                  onChange={(e) => setFormData({ ...formData, assigned_to_user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Contact Number
                  </label>
                  <input
                    type="text"
                    value={formData.vendor_contact}
                    onChange={(e) => setFormData({ ...formData, vendor_contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Maintenance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Warranty Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.warranty_end_date}
                    onChange={(e) => setFormData({ ...formData, warranty_end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Maintenance Date
                  </label>
                  <input
                    type="date"
                    value={formData.last_maintenance_date}
                    onChange={(e) => setFormData({ ...formData, last_maintenance_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User Manual URL
                </label>
                <input
                  type="url"
                  value={formData.user_manual_url}
                  onChange={(e) => setFormData({ ...formData, user_manual_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/manual.pdf"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
