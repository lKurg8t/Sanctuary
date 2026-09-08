import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, Couple, PhotoMemory, PhotoAlbum } from '../types';
import { Camera, Plus, Heart, MessageCircle, Sparkles, FolderPlus, X, Calendar, Image, Send, Check } from 'lucide-react';
import confetti from 'canvas-confetti';

interface MemoriesViewProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  photos: PhotoMemory[];
  albums: PhotoAlbum[];
  onUploadPhoto: (data: { imageUrl: string; caption?: string; albumId?: string; memoryDate?: string }) => Promise<void>;
  onReactPhoto: (photoId: string, emoji: string) => Promise<void>;
  onCommentPhoto: (photoId: string, text: string) => Promise<void>;
  onCreateAlbum: (name: string, description: string, coverUrl?: string) => Promise<void>;
}

const REACTION_EMOJIS = ['❤️', '✨', '💖', '🌊', '🥂', '🥰', '🔥'];

export const MemoriesView: React.FC<MemoriesViewProps> = ({
  currentUser,
  couple,
  partner,
  photos,
  albums,
  onUploadPhoto,
  onReactPhoto,
  onCommentPhoto,
  onCreateAlbum
}) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('all');
  const [activePhoto, setActivePhoto] = useState<PhotoMemory | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewAlbumModal, setShowNewAlbumModal] = useState(false);

  // Upload Form State
  const [uploadImageUrl, setUploadImageUrl] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadAlbumId, setUploadAlbumId] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Album Form State
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');

  // Comment Form State in Lightbox
  const [commentText, setCommentText] = useState('');

  // Reset local state when user session or couple changes
  useEffect(() => {
    setSelectedAlbumId('all');
    setActivePhoto(null);
    setShowUploadModal(false);
    setShowNewAlbumModal(false);
    setUploadImageUrl('');
    setUploadCaption('');
    setCommentText('');
  }, [currentUser?.id, couple?.id]);

  // Keep active photo in sync with real-time updates (reactions, comments, deletion)
  useEffect(() => {
    if (activePhoto) {
      const updated = photos.find(p => p.id === activePhoto.id);
      if (updated) {
        setActivePhoto(updated);
      } else {
        setActivePhoto(null);
      }
    }
  }, [photos]);

  // Handle local image file
  const handleLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadImageUrl) return;

    await onUploadPhoto({
      imageUrl: uploadImageUrl,
      caption: uploadCaption,
      albumId: uploadAlbumId || (albums[0]?.id || 'album-1'),
      memoryDate: uploadDate
    });

    setUploadImageUrl('');
    setUploadCaption('');
    setShowUploadModal(false);
    confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
  };

  const handleCreateAlbumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;
    await onCreateAlbum(newAlbumName, newAlbumDesc);
    setNewAlbumName('');
    setNewAlbumDesc('');
    setShowNewAlbumModal(false);
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePhoto || !commentText.trim()) return;

    await onCommentPhoto(activePhoto.id, commentText.trim());
    setCommentText('');
    confetti({ particleCount: 25, spread: 40, origin: { y: 0.8 } });
  };

  const filteredPhotos = photos.filter(p => {
    if (selectedAlbumId === 'all') return true;
    if (selectedAlbumId === 'favorites') return p.isFavorite;
    return p.albumId === selectedAlbumId;
  });

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* 1. HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-amber-100 text-amber-600">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-stone-800">
              Shared Memory Vault
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Every chapter, trip, smile, and sunset frozen in time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowNewAlbumModal(true)}
            className="px-3 py-2 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Album</span>
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-200 transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Photo</span>
          </button>
        </div>
      </div>

      {/* 2. ALBUM FILTER CHIPS */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedAlbumId('all')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            selectedAlbumId === 'all'
              ? 'bg-stone-800 text-white shadow-xs'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          All Moments ({photos.length})
        </button>

        {albums.map(alb => (
          <button
            key={alb.id}
            onClick={() => setSelectedAlbumId(alb.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              selectedAlbumId === alb.id
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            📁 {alb.name}
          </button>
        ))}
      </div>

      {/* 3. PHOTO GRID */}
      {filteredPhotos.length === 0 ? (
        <div className="p-10 rounded-3xl bg-white border border-stone-200 text-center space-y-3">
          <Camera className="w-12 h-12 text-stone-300 mx-auto" />
          <h3 className="font-serif font-bold text-stone-800">Start collecting your favorite moments.</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Upload your first photo from a date, anniversary, or spontaneous moment together.
          </p>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 rounded-2xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-sm"
          >
            Upload Photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
          {filteredPhotos.map(photo => {
            const reactionKeys = Object.keys(photo.reactions || {});
            const totalReactions = reactionKeys.reduce((acc, k) => acc + photo.reactions[k].length, 0);

            return (
              <div
                key={photo.id}
                onClick={() => setActivePhoto(photo)}
                className="group relative aspect-square rounded-2xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-xs cursor-pointer hover:shadow-md transition-all"
              >
                <img
                  src={photo.imageUrl}
                  alt={photo.caption}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Gradient overlay with caption & badges */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-90 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2.5">
                  <div className="flex justify-end">
                    {photo.isFavorite && (
                      <span className="p-1 rounded-full bg-rose-500/80 text-white">
                        <Heart className="w-3 h-3 fill-white" />
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5 text-white">
                    <p className="text-xs font-medium truncate drop-shadow-sm">
                      {photo.caption || photo.albumName}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-stone-300">
                      <span>{photo.memoryDate}</span>
                      <div className="flex items-center gap-1.5">
                        {totalReactions > 0 && <span>❤️ {totalReactions}</span>}
                        {photo.comments.length > 0 && <span>💬 {photo.comments.length}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. PHOTO LIGHTBOX MODAL */}
      {activePhoto && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-stone-200">
            {/* Lightbox Header */}
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {activePhoto.albumName}
                </span>
                <span className="text-xs text-stone-500 font-medium">{activePhoto.memoryDate}</span>
              </div>
              <button
                onClick={() => setActivePhoto(null)}
                className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-res Image Display */}
            <div className="bg-stone-950 flex items-center justify-center max-h-[50vh] overflow-hidden">
              <img
                src={activePhoto.imageUrl}
                alt={activePhoto.caption}
                className="max-h-[50vh] w-auto object-contain"
              />
            </div>

            {/* Lightbox Body (Captions, Reactions, Comments) */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Caption */}
              {activePhoto.caption && (
                <p className="text-sm font-medium text-stone-800 leading-relaxed font-serif">
                  "{activePhoto.caption}"
                </p>
              )}

              {/* Love Reactions Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {REACTION_EMOJIS.map(emoji => {
                  const uids = activePhoto.reactions?.[emoji] || [];
                  const isReacted = uids.includes(currentUser.id);
                  return (
                    <button
                      key={emoji}
                      onClick={() => onReactPhoto(activePhoto.id, emoji)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isReacted
                          ? 'bg-rose-100 border-rose-300 text-rose-800'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span className="text-sm">{emoji}</span>
                      {uids.length > 0 && <span className="font-bold">{uids.length}</span>}
                    </button>
                  );
                })}
              </div>

              {/* Comments Stream */}
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                  Reflections & Comments ({activePhoto.comments.length})
                </h4>

                {activePhoto.comments.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No notes yet. Leave a sweet comment below ❤️</p>
                ) : (
                  activePhoto.comments.map(comm => (
                    <div key={comm.id} className="p-3 rounded-2xl bg-stone-50 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-800">{comm.userName}</span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-stone-600 font-medium">{comm.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Comment Input Footer */}
            <form onSubmit={handleCommentSubmit} className="p-3 border-t border-stone-100 bg-stone-50 flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Leave a sweet memory reflection..."
                className="flex-1 px-3.5 py-2 text-xs bg-white rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400 text-stone-800"
              />
              <button
                type="submit"
                disabled={!commentText.trim()}
                className="p-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. UPLOAD PHOTO MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-800 flex items-center gap-2">
                <Camera className="w-4 h-4 text-rose-500" />
                <span>Add Photo to Memory Vault</span>
              </h3>
              <button onClick={() => setShowUploadModal(false)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-3">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleLocalFile}
                className="hidden"
              />

              {/* Photo selector box */}
              {uploadImageUrl ? (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-stone-200 bg-stone-100">
                  <img src={uploadImageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setUploadImageUrl('')}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-rose-200 hover:border-rose-400 rounded-2xl p-6 text-center cursor-pointer bg-rose-50/50 hover:bg-rose-50 transition-colors space-y-2"
                >
                  <Image className="w-8 h-8 text-rose-400 mx-auto" />
                  <p className="text-xs font-semibold text-rose-700">Click to choose image file</p>
                  <p className="text-[10px] text-stone-400">or paste image URL below</p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600">Image Web URL (Optional)</label>
                <input
                  type="text"
                  value={uploadImageUrl.startsWith('data:') ? '' : uploadImageUrl}
                  onChange={e => setUploadImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600">Caption / Note</label>
                <input
                  type="text"
                  value={uploadCaption}
                  onChange={e => setUploadCaption(e.target.value)}
                  placeholder="What made this moment unforgettable?"
                  className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600">Select Album</label>
                  <select
                    value={uploadAlbumId}
                    onChange={e => setUploadAlbumId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none"
                  >
                    {albums.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600">Memory Date</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={e => setUploadDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadImageUrl}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-semibold text-xs shadow-md shadow-rose-200"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. CREATE ALBUM MODAL */}
      {showNewAlbumModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-800 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-rose-500" />
                <span>Create New Memory Album</span>
              </h3>
              <button onClick={() => setShowNewAlbumModal(false)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAlbumSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600">Album Name</label>
                <input
                  type="text"
                  required
                  value={newAlbumName}
                  onChange={e => setNewAlbumName(e.target.value)}
                  placeholder="e.g. Paris Summer 2024"
                  className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600">Description</label>
                <input
                  type="text"
                  value={newAlbumDesc}
                  onChange={e => setNewAlbumDesc(e.target.value)}
                  placeholder="A few words about this collection..."
                  className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAlbumModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs"
                >
                  Create Album
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
