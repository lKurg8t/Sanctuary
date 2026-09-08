import React, { useState } from 'react';
import { UserProfile, Couple, Book, ReadingProgress, Bookmark } from '../types';
import { BookOpen, Bookmark as BookmarkIcon, Plus, Check, ChevronLeft, ChevronRight, Share2, Sparkles, Heart, Trash2, X, Search, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

interface LibraryViewProps {
  currentUser: UserProfile;
  couple: Couple | null;
  partner: UserProfile | null;
  books: Book[];
  readingProgress: ReadingProgress[];
  bookmarks: Bookmark[];
  activeBookId?: string | null;
  onCloseReader: () => void;
  onOpenBook: (bookId: string) => void;
  onAddBook: (book: Partial<Book>) => Promise<void>;
  onUpdateProgress: (bookId: string, page: number, totalPages: number) => Promise<void>;
  onAddBookmark: (bookId: string, page: number, chapterTitle: string, note: string, isShared: boolean) => Promise<void>;
  onDeleteBookmark: (bookmarkId: string) => Promise<void>;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  currentUser,
  couple,
  partner,
  books,
  readingProgress,
  bookmarks,
  activeBookId,
  onCloseReader,
  onOpenBook,
  onAddBook,
  onUpdateProgress,
  onAddBookmark,
  onDeleteBookmark
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Reader view state
  const activeBook = books.find(b => b.id === activeBookId);
  const [currentPage, setCurrentPage] = useState(1);
  const [readerFontSize, setReaderFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [readerTheme, setReaderTheme] = useState<'parchment' | 'clean' | 'night'>('parchment');
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarkIsShared, setBookmarkIsShared] = useState(true);

  // New Book form state
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newCategory, setNewCategory] = useState('Romantic Literature');
  const [newCoverUrl, setNewCoverUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');

  // Sync initial page when reader opens
  React.useEffect(() => {
    if (activeBook) {
      const myProg = readingProgress.find(p => p.bookId === activeBook.id && p.userId === currentUser.id);
      if (myProg) setCurrentPage(myProg.currentPage || 1);
      else setCurrentPage(1);
    }
  }, [activeBookId, currentUser.id]);

  const categories = ['All', ...Array.from(new Set(books.map(b => b.category)))];

  const filteredBooks = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.author.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || b.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handlePageChange = async (newPage: number) => {
    if (!activeBook) return;
    const clamped = Math.max(1, Math.min(activeBook.content.length || activeBook.totalPages, newPage));
    setCurrentPage(clamped);
    await onUpdateProgress(activeBook.id, clamped, activeBook.content.length || activeBook.totalPages);
  };

  const handleSaveBookmark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBook) return;
    await onAddBookmark(
      activeBook.id,
      currentPage,
      `Chapter ${currentPage}`,
      bookmarkNote,
      bookmarkIsShared
    );
    setBookmarkNote('');
    setShowBookmarkModal(false);
    confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim()) return;

    const chapters = newContent.trim()
      ? newContent.split('\n\n---PAGE---\n\n')
      : ['Chapter 1: Dedicated to Us\n\nEvery story we read together brings us closer.'];

    await onAddBook({
      coupleId: couple?.id,
      title: newTitle,
      author: newAuthor,
      category: newCategory,
      description: newDescription,
      coverUrl: newCoverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
      totalPages: chapters.length,
      content: chapters,
      uploadedBy: currentUser.id,
      uploaderName: currentUser.displayName
    });

    setNewTitle('');
    setNewAuthor('');
    setNewDescription('');
    setNewContent('');
    setShowAddModal(false);
  };

  // Active book bookmarks
  const activeBookBookmarks = activeBook
    ? bookmarks.filter(b => b.bookId === activeBook.id && (b.userId === currentUser.id || b.isShared))
    : [];

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-300">
      {/* 1. BOOKSHELF HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-amber-100 text-amber-700">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-stone-800">
              Shared Bookshelf
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Read together, leave love notes, and track your mutual progress.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="self-start sm:self-auto px-4 py-2 rounded-2xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Book</span>
        </button>
      </div>

      {/* 2. SEARCH & CATEGORIES */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search titles or authors..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-white rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 text-stone-800 placeholder-stone-400"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 3. BOOKS GRID */}
      {filteredBooks.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-stone-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-stone-300 mx-auto" />
          <h3 className="font-serif font-bold text-stone-800">Your shared bookshelf is waiting.</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Upload your favorite love letters, relationship books, or poems to start reading together.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredBooks.map(book => {
            const myProg = readingProgress.find(p => p.bookId === book.id && p.userId === currentUser.id);
            const partnerProg = partner ? readingProgress.find(p => p.bookId === book.id && p.userId === partner.id) : null;
            const bookBms = bookmarks.filter(b => b.bookId === book.id);

            return (
              <div
                key={book.id}
                className="p-5 rounded-3xl bg-white border border-stone-200 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow group"
              >
                <div className="flex gap-4">
                  <div className="relative w-20 h-28 rounded-2xl overflow-hidden shadow-md shrink-0 ring-1 ring-stone-200">
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-[9px] font-bold">
                      {book.totalPages} pgs
                    </span>
                  </div>

                  <div className="space-y-1 flex-1 overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {book.category}
                    </span>
                    <h3 className="font-serif font-bold text-sm text-stone-800 truncate">
                      {book.title}
                    </h3>
                    <p className="text-xs text-stone-500 truncate">{book.author}</p>
                    <p className="text-[11px] text-stone-600 line-clamp-2 leading-relaxed">
                      {book.description}
                    </p>
                  </div>
                </div>

                {/* Couple Reading Progress Dual Bar */}
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-stone-500 font-medium">{currentUser.displayName}'s Progress:</span>
                      <span className="font-bold text-rose-600">{myProg?.percentage || 0}%</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-rose-500 h-1.5 rounded-full"
                        style={{ width: `${myProg?.percentage || 0}%` }}
                      />
                    </div>
                  </div>

                  {partner && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-stone-500 font-medium">{partner.displayName}'s Progress:</span>
                        <span className="font-bold text-amber-600">{partnerProg?.percentage || 0}%</span>
                      </div>
                      <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-amber-500 h-1.5 rounded-full"
                          style={{ width: `${partnerProg?.percentage || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {bookBms.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-rose-700 pt-1 font-medium">
                      <BookmarkIcon className="w-3 h-3 text-rose-500" />
                      <span>{bookBms.length} partner reflection(s)</span>
                    </div>
                  )}
                </div>

                {/* Open E-reader Button */}
                <button
                  onClick={() => onOpenBook(book.id)}
                  className="w-full py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-rose-50 hover:text-rose-700 text-stone-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Open Reader ({myProg?.currentPage ? `Page ${myProg.currentPage}` : 'Start Book'})</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODAL: FULL E-READER EXPERIENCE */}
      {activeBook && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
          <div
            className={`w-full max-w-2xl h-[92vh] rounded-3xl flex flex-col shadow-2xl overflow-hidden border transition-colors ${
              readerTheme === 'parchment'
                ? 'bg-[#fdfbf7] text-stone-900 border-amber-200'
                : readerTheme === 'night'
                ? 'bg-[#18181b] text-stone-100 border-stone-800'
                : 'bg-white text-stone-900 border-stone-200'
            }`}
          >
            {/* E-Reader Top Bar */}
            <div className="px-5 py-3 border-b border-black/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <button
                  onClick={onCloseReader}
                  className="p-1.5 rounded-xl hover:bg-black/5 text-stone-500 hover:text-stone-800"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="truncate">
                  <h4 className="font-serif font-bold text-xs sm:text-sm truncate">
                    {activeBook.title}
                  </h4>
                  <p className="text-[10px] text-stone-500 truncate">{activeBook.author}</p>
                </div>
              </div>

              {/* Reader controls */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Font size toggle */}
                <div className="flex bg-black/5 rounded-xl p-0.5 text-xs font-semibold">
                  <button
                    onClick={() => setReaderFontSize('sm')}
                    className={`px-2 py-1 rounded-lg ${readerFontSize === 'sm' ? 'bg-white shadow-xs' : ''}`}
                  >
                    A-
                  </button>
                  <button
                    onClick={() => setReaderFontSize('base')}
                    className={`px-2 py-1 rounded-lg ${readerFontSize === 'base' ? 'bg-white shadow-xs' : ''}`}
                  >
                    A
                  </button>
                  <button
                    onClick={() => setReaderFontSize('lg')}
                    className={`px-2 py-1 rounded-lg ${readerFontSize === 'lg' ? 'bg-white shadow-xs' : ''}`}
                  >
                    A+
                  </button>
                </div>

                {/* Theme toggle */}
                <button
                  onClick={() => setReaderTheme(readerTheme === 'parchment' ? 'night' : readerTheme === 'night' ? 'clean' : 'parchment')}
                  className="p-1.5 rounded-xl bg-black/5 text-xs font-medium"
                  title="Toggle Theme"
                >
                  {readerTheme === 'parchment' ? '📜' : readerTheme === 'night' ? '🌙' : '☀️'}
                </button>

                {/* Bookmark trigger */}
                <button
                  onClick={() => setShowBookmarkModal(true)}
                  className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100"
                  title="Bookmark & Leave Reflection"
                >
                  <BookmarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bookmarks bar */}
            {activeBookBookmarks.length > 0 && (
              <div className="px-5 py-2 bg-rose-50/80 border-b border-rose-100 flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-[11px] font-bold text-rose-800 shrink-0">Bookmarks:</span>
                {activeBookBookmarks.map(bm => (
                  <div
                    key={bm.id}
                    onClick={() => handlePageChange(bm.pageNumber)}
                    className="cursor-pointer px-2.5 py-1 rounded-xl bg-white border border-rose-200 text-rose-700 flex items-center gap-1.5 shrink-0 hover:bg-rose-100"
                  >
                    <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                    <span>Page {bm.pageNumber}</span>
                    <span className="text-[10px] text-stone-500">({bm.userName})</span>
                  </div>
                ))}
              </div>
            )}

            {/* E-Reader Content Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4">
              <div
                className={`font-serif leading-relaxed whitespace-pre-wrap ${
                  readerFontSize === 'sm'
                    ? 'text-sm sm:text-base'
                    : readerFontSize === 'lg'
                    ? 'text-lg sm:text-xl'
                    : 'text-base sm:text-lg'
                }`}
              >
                {activeBook.content[currentPage - 1] || 'No page content available.'}
              </div>
            </div>

            {/* E-Reader Footer Page Navigation */}
            <div className="px-6 py-3 border-t border-black/10 flex items-center justify-between text-xs font-semibold">
              <button
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 disabled:opacity-30 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev Page</span>
              </button>

              <span className="text-stone-500">
                Page {currentPage} of {activeBook.content.length || activeBook.totalPages}
              </span>

              <button
                disabled={currentPage >= (activeBook.content.length || activeBook.totalPages)}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-3 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 disabled:opacity-30 flex items-center gap-1"
              >
                <span>Next Page</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: ADD BOOKMARK WITH NOTE */}
      {showBookmarkModal && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-800 flex items-center gap-2">
                <BookmarkIcon className="w-4 h-4 text-rose-500" />
                <span>Bookmark Page {currentPage}</span>
              </h3>
              <button onClick={() => setShowBookmarkModal(false)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBookmark} className="space-y-3">
              <textarea
                value={bookmarkNote}
                onChange={e => setBookmarkNote(e.target.value)}
                placeholder="Leave a sweet note or reflection about this page for your partner..."
                rows={3}
                className="w-full p-3 text-xs bg-stone-50 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 text-stone-800"
              />

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bookmarkIsShared}
                    onChange={e => setBookmarkIsShared(e.target.checked)}
                    className="accent-rose-500 rounded w-4 h-4"
                  />
                  <span className="font-medium text-stone-700">Share bookmark with partner ❤️</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookmarkModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md shadow-rose-200"
                >
                  Save Reflection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: ADD CUSTOM BOOK */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-base text-stone-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-rose-500" />
                <span>Add Book to Shared Bookshelf</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBook} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600">Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Letters from the Heart"
                    className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600">Author</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={e => setNewAuthor(e.target.value)}
                    placeholder="e.g. Liam & Olivia"
                    className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600">Category</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="e.g. Romantic Literature"
                    className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-600">Cover Image URL</label>
                  <input
                    type="text"
                    value={newCoverUrl}
                    onChange={e => setNewCoverUrl(e.target.value)}
                    placeholder="https://... (Optional)"
                    className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600">Description</label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="A short summary of this book..."
                  className="w-full px-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-600">
                  Book Text Content (Separate pages with <code className="text-rose-600">---PAGE---</code>)
                </label>
                <textarea
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  placeholder="Paste or write your story here..."
                  rows={4}
                  className="w-full p-3 text-xs bg-stone-50 rounded-2xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-semibold text-xs"
                >
                  Publish to Sanctuary
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
