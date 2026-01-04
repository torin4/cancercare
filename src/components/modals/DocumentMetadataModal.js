import React from 'react';
import { X } from 'lucide-react';
import { parseLocalDate } from '../../utils/helpers';

export default function DocumentMetadataModal({ show, document, onClose }) {
  if (!show || !document) return null;

  return (
    <div 
      className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Document Metadata</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition"
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">File Name</p>
            <p className="text-sm text-gray-900">{document.fileName || document.name || 'Unknown'}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Document Type</p>
            <p className="text-sm text-gray-900">{document.documentType || document.type || 'Unknown'}</p>
          </div>

          {document.dataPointCount !== undefined && document.dataPointCount !== null && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Extracted Data Points</p>
              <p className="text-sm text-gray-900 font-semibold">{document.dataPointCount} data point{document.dataPointCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {document.fileSize && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">File Size</p>
              <p className="text-sm text-gray-900">
                {document.fileSize < 1024 
                  ? `${document.fileSize} bytes`
                  : document.fileSize < 1024 * 1024
                  ? `${(document.fileSize / 1024).toFixed(2)} KB`
                  : `${(document.fileSize / (1024 * 1024)).toFixed(2)} MB`}
              </p>
            </div>
          )}

          {document.fileType && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">File Type</p>
              <p className="text-sm text-gray-900">{document.fileType}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Upload Date</p>
            <p className="text-sm text-gray-900">
              {parseLocalDate(document.date).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          {document.note && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Note</p>
              <p className="text-sm text-gray-900 italic">{document.note}</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

