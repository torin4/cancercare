import React, { useState } from 'react';
import { uploadDocument, deleteDocument } from '../firebase/storage';
import { documentService } from '../firebase/services';
import { auth } from '../firebase/config';

/**
 * Example component showing how to upload files to Firebase Storage
 */
export default function FileUploadExample() {
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);

  // Load user's documents
  const loadDocuments = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const docs = await documentService.getDocuments(userId);
      setDocuments(docs);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      setError('You must be logged in to upload files');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      // Upload file with metadata
      const result = await uploadDocument(file, userId, {
        category: 'medical-records',
        notes: 'Uploaded via web app'
      });

      console.log('File uploaded successfully:', result);

      // Refresh the document list
      await loadDocuments();
    } catch (err) {
      setError(err.message);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  // Handle file deletion
  const handleDelete = async (docId, storagePath) => {
    if (!window.confirm('Are you sure you want to delete this file?')) return;

    const userId = auth.currentUser?.uid;
    if (!userId) {
      setError('You must be logged in to delete files');
      return;
    }

    try {
      await deleteDocument(docId, storagePath, userId);
      console.log('File deleted successfully');

      // Refresh the document list
      await loadDocuments();
    } catch (err) {
      setError(err.message);
      console.error('Delete error:', err);
    }
  };

  // Load documents on mount
  React.useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Document Upload</h2>

      {/* Upload Form */}
      <div className="mb-6">
        <label className="block mb-2">
          <span className="text-sm font-medium">Upload Document:</span>
          <input
            type="file"
            onChange={handleFileUpload}
            disabled={uploading}
            className="block w-full mt-1 p-2 border rounded"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
        </label>
        {uploading && <p className="text-blue-600">Uploading...</p>}
        {error && <p className="text-red-600">{error}</p>}
      </div>

      {/* Document List */}
      <div>
        <h3 className="text-xl font-semibold mb-3">Your Documents</h3>
        {documents.length === 0 ? (
          <p className="text-gray-500">No documents uploaded yet</p>
        ) : (
          <ul className="space-y-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{doc.fileName}</p>
                  <p className="text-sm text-gray-600">
                    {(doc.fileSize / 1024).toFixed(2)} KB - {doc.fileType}
                  </p>
                  <p className="text-xs text-gray-500">
                    Uploaded: {doc.date?.toLocaleDateString()}
                  </p>
                </div>
                <div className="space-x-2">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View
                  </a>
                  <button
                    onClick={() => handleDelete(doc.id, doc.storagePath)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
