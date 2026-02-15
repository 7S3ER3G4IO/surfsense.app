"use client";

import { useState, useEffect } from "react";
import { Upload, Send, FileVideo, CheckCircle, AlertTriangle, X } from "lucide-react";

export default function ComposePage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [adminToken, setAdminToken] = useState("");

  const networks = [
    { id: "instagram", label: "Instagram" },
    { id: "tiktok", label: "TikTok" },
    { id: "youtube", label: "YouTube Shorts" },
    { id: "facebook", label: "Facebook" },
    { id: "twitter", label: "Twitter / X" },
    { id: "linkedin", label: "LinkedIn" }
  ];

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) setAdminToken(token);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setUploadedFileName(null);
      setStatus(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setStatus(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const token = localStorage.getItem("admin_token") || adminToken;
          
          const res = await fetch(`/api/admin/marketing/upload-video?token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: file.name, base64: base64 })
          });

          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          
          if (data.success) {
            setUploadedFileName(file.name); // Usually server returns success, we assume name is kept or handled
            setStatus({ type: 'success', message: "Video uploaded successfully! Ready to publish." });
          } else {
            throw new Error(data.error || "Upload failed");
          }
        } catch (err: any) {
          setStatus({ type: 'error', message: err.message || "Upload failed" });
        } finally {
            setIsUploading(false);
        }
      };
      reader.onerror = () => {
        setStatus({ type: 'error', message: "Error reading file" });
        setIsUploading(false);
      };
    } catch (err) {
      setIsUploading(false);
      setStatus({ type: 'error', message: "Unexpected error during upload" });
    }
  };

  const handlePublish = async () => {
    if (!uploadedFileName || selectedNetworks.length === 0) return;
    setIsPublishing(true);
    setStatus(null);

    try {
      const token = localStorage.getItem("admin_token") || adminToken;
      const res = await fetch(`/api/admin/marketing/publish-video?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video: uploadedFileName,
          networks: selectedNetworks,
          caption: caption
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const successCount = data.results.filter((r: any) => r.ok).length;
        const failCount = data.results.length - successCount;
        setStatus({ 
            type: successCount > 0 ? 'success' : 'error', 
            message: `Published to ${successCount} networks. ${failCount > 0 ? `${failCount} failed.` : ''}`
        });
        if (successCount === data.results.length) {
             setFile(null);
             setUploadedFileName(null);
             setCaption("");
             setSelectedNetworks([]);
        }
      } else {
        throw new Error(data.error || "Publishing failed");
      }
    } catch (err: any) {
        setStatus({ type: 'error', message: err.message || "Publishing failed" });
    } finally {
        setIsPublishing(false);
    }
  };

  const toggleNetwork = (id: string) => {
    if (selectedNetworks.includes(id)) {
      setSelectedNetworks(selectedNetworks.filter(n => n !== id));
    } else {
      setSelectedNetworks([...selectedNetworks, id]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Compose Post</h1>
        <p className="text-gray-500 dark:text-gray-400">Upload video and publish to multiple networks</p>
      </div>

      {status && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
          {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {status.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Upload */}
        <div className="space-y-6">
          <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${uploadedFileName ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-300 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500'}`}>
             <input 
                type="file" 
                id="video-upload" 
                className="hidden" 
                accept="video/*,image/*"
                onChange={handleFileChange}
                disabled={isUploading || isPublishing}
             />
             
             {!file ? (
                <label htmlFor="video-upload" className="cursor-pointer block">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <span className="block font-medium text-lg mb-1">Click to upload video</span>
                    <span className="text-sm text-gray-500">MP4, MOV up to 50MB</span>
                </label>
             ) : (
                <div className="relative">
                    <FileVideo className="w-12 h-12 mx-auto text-indigo-500 mb-4" />
                    <p className="font-medium truncate max-w-xs mx-auto">{file.name}</p>
                    <p className="text-sm text-gray-500 mb-4">{(file.size / (1024*1024)).toFixed(2)} MB</p>
                    
                    {!uploadedFileName && (
                        <div className="flex justify-center gap-2">
                            <button 
                                onClick={() => setFile(null)}
                                className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
                            >
                                Remove
                            </button>
                            <button 
                                onClick={handleUpload}
                                disabled={isUploading}
                                className="px-4 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isUploading ? "Uploading..." : "Upload Now"}
                            </button>
                        </div>
                    )}
                    
                    {uploadedFileName && (
                         <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                            <CheckCircle className="w-4 h-4" />
                            Uploaded
                         </div>
                    )}
                </div>
             )}
          </div>
        </div>

        {/* Right Column: Publish Details */}
        <div className={`space-y-6 ${!uploadedFileName ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
             <div>
                <label className="block text-sm font-medium mb-2">Caption</label>
                <textarea 
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    className="w-full h-32 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 resize-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Write your caption here..."
                ></textarea>
             </div>

             <div>
                <label className="block text-sm font-medium mb-3">Target Networks</label>
                <div className="grid grid-cols-2 gap-3">
                    {networks.map((net) => (
                        <div 
                            key={net.id}
                            onClick={() => toggleNetwork(net.id)}
                            className={`cursor-pointer p-3 rounded-lg border flex items-center justify-between transition-all ${
                                selectedNetworks.includes(net.id) 
                                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                        >
                            <span className="text-sm font-medium">{net.label}</span>
                            {selectedNetworks.includes(net.id) && <CheckCircle className="w-4 h-4" />}
                        </div>
                    ))}
                </div>
             </div>

             <button 
                onClick={handlePublish}
                disabled={isPublishing || selectedNetworks.length === 0}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
             >
                {isPublishing ? (
                    <>Processing...</>
                ) : (
                    <>
                        <Send className="w-5 h-5" />
                        Publish Post
                    </>
                )}
             </button>
        </div>
      </div>
    </div>
  );
}
