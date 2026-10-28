import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../types';
import { 
  ShoppingBag, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  GraduationCap, 
  Clock, 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  Building2, 
  HelpCircle, 
  Eye, 
  EyeOff, 
  Database, 
  UserPlus, 
  LogIn, 
  Phone, 
  AlertCircle 
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, register, backendStatus } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');

  // Sign-in uses the institutional roll number as the username.
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Signup Form States
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [department, setDepartment] = useState('Computer Science & Eng');
  const [hostel, setHostel] = useState('Block C (Aryabhatta)');
  const [roomNumber, setRoomNumber] = useState('204');
  const [phone, setPhone] = useState('');

  // UI state
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeRollNumber = authMode === 'login' ? username : rollNumber;
  const selectedRole: UserRole = activeRollNumber.trim().startsWith('23') ? 'seller' : 'buyer';
  const isBuyer = selectedRole === 'buyer';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const identity = authMode === 'login' ? username : email;
    if (!identity.trim() || !password) {
      setFeedback({ type: 'error', message: authMode === 'login' ? 'Enter your roll number and password.' : 'Enter your campus email and password.' });
      return;
    }

    if (authMode === 'signup' && !email.includes('@')) {
      setFeedback({ type: 'error', message: 'Please enter a valid campus email (e.g. name@campus.edu)' });
      return;
    }

    const cleanRoll = (authMode === 'login' ? username : rollNumber).trim().toUpperCase();
    if (!cleanRoll.startsWith('23') && !cleanRoll.startsWith('24')) {
      setFeedback({ type: 'error', message: 'Roll numbers must start with 23 for seller accounts or 24 for buyer accounts.' });
      return;
    }

    if (authMode === 'signup' && (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password))) {
      setFeedback({ type: 'error', message: 'Use at least 8 characters with uppercase, lowercase, a number, and a symbol.' });
      return;
    }

    setIsSubmitting(true);

    if (authMode === 'login') {
      const res = await login(username, password);
      setIsSubmitting(false);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.message || 'Login failed. Please check credentials.' });
      }
    } else {
      // Signup Mode
      if (!name.trim()) {
        setIsSubmitting(false);
        setFeedback({ type: 'error', message: 'Please enter your full student name.' });
        return;
      }
      if (!rollNumber.trim()) {
        setIsSubmitting(false);
        setFeedback({ type: 'error', message: 'Please enter your institutional Roll / ID number.' });
        return;
      }

      const res = await register({
        name,
        email,
        password,
        rollNumber,
        department,
        hostel,
        roomNumber,
        phone,
      });

      setIsSubmitting(false);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.message || 'Signup failed' });
      } else {
        setFeedback({ type: 'success', message: 'Account registered and saved to MongoDB Atlas! Redirecting...' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
      {/* Top Banner Ticker with MongoDB Database Status */}
      <div className="bg-indigo-600/20 border-b border-indigo-500/20 backdrop-blur-md px-4 py-2 text-xs md:text-sm text-indigo-200">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-white">Campus Clearance Active:</span>
            <span>Final-year seniors leaving in ~5 days. Live MongoDB Database Connected.</span>
          </div>
          
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 border border-slate-700 text-slate-300">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>MongoDB Atlas:</span>
              <span className="text-emerald-400 font-mono">cluster0.rmqonk5</span>
              <span className={`w-2 h-2 rounded-full ${backendStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
            </div>
            <span className="hidden md:flex items-center gap-1 text-indigo-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Quad Handovers
            </span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-10 flex flex-col justify-center">
        
        {/* Header Title */}
        <div className="text-center mb-6 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs md:text-sm font-medium mb-3">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Where Campus Competes Fairly &bull; Backed by MongoDB Atlas
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-2">
            Bid<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Nest</span>
          </h1>
          <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
            Role-based campus marketplace with verified student profiles, real-time English auctioning, proxy limits, and in-person quad handovers.
          </p>
        </div>

        {/* Dual Role + Sign In / Sign Up Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: Role Details & Value Story */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 backdrop-blur-xl">
            <div>
              {/* Primary Role Switcher Tabs */}
              <div className="mb-5 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-xs text-slate-300">
                Account type is verified from your roll number: <strong className="text-white">23 = seller</strong>, <strong className="text-white">24 = buyer</strong>.
              </div>

              {isBuyer ? (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                    <GraduationCap className="w-4 h-4" />
                    For Incoming & Continuing Students
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                    Fair, transparent bidding on campus essentials.
                  </h2>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    Senior students departing campus within 5 days have listed cycles, Casio calculators, textbook sets, and hostel room electronics.
                  </p>

                  <div className="space-y-2.5 pt-2 text-xs md:text-sm text-slate-300">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-blue-500/20 text-blue-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-white block font-medium">Automatic Proxy Bidding:</strong>
                        Set your maximum price. The engine bids only when outbid.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-blue-500/20 text-blue-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-white block font-medium">Anti-Sniping 60s Extension:</strong>
                        Last-minute bids automatically extend the closing timer.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-blue-500/20 text-blue-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-white block font-medium">Database-Backed Profile:</strong>
                        Verified campus credentials and reputation tracking.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                    <Clock className="w-4 h-4" />
                    For Graduating Seniors Vacating Hostel Rooms
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                    Liquidate your room before convocation week.
                  </h2>
                  <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                    Avoid discarding working equipment or dealing with 50 WhatsApp direct messages. Let competing juniors find true market value.
                  </p>

                  <div className="space-y-2.5 pt-2 text-xs md:text-sm text-slate-300">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-purple-500/20 text-purple-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-white block font-medium">Final Price Approval:</strong>
                        You review and approve or reject the closing winning bid.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-purple-500/20 text-purple-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-white block font-medium">Pre-Bid Q&A Moderation:</strong>
                        Answer buyer questions publicly so you don't repeat yourself.
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="p-1 rounded bg-purple-500/20 text-purple-400 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <strong className="text-white block font-medium">In-Person Quad Handovers:</strong>
                        Physical handover confirmation completes the sale safely.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Micro Badge */}
            <div className="mt-6 pt-4 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                Verified Campus Network
              </span>
              <span className="font-mono text-[11px] text-emerald-400">
                JWT Auth &bull; bcrypt Hash
              </span>
            </div>
          </div>

          {/* Right Column: Sign In / Sign Up Form */}
          <div className="lg:col-span-7 bg-slate-800/80 border border-slate-700 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl flex flex-col justify-between">
            <div>
              {/* Form Mode Toggle: Login vs Sign Up */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-700">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setFeedback(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      authMode === 'login'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setFeedback(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      authMode === 'signup'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Create Account (Sign Up)
                  </button>
                </div>

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isBuyer ? 'bg-indigo-600/20 text-indigo-400' : 'bg-purple-600/20 text-purple-400'
                  }`}
                >
                  {isBuyer ? <ShoppingBag className="w-5 h-5" /> : <Tag className="w-5 h-5" />}
                </div>
              </div>

              {/* Title & Subtitle */}
              <div className="mb-4">
                <h3 className="text-lg md:text-xl font-bold text-white">
                  {authMode === 'login'
                    ? `Sign In as ${isBuyer ? 'Junior Buyer' : 'Senior Seller'}`
                    : `Register New ${isBuyer ? 'Junior Buyer' : 'Senior Seller'} Account`}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {authMode === 'login'
                    ? 'Enter your registered campus email and password to access the auction portal.'
                    : 'Your profile will be stored securely in the MongoDB Atlas campus cluster.'}
                </p>
              </div>

              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`mb-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    feedback.type === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {feedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* The Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                
                {/* SIGN UP ONLY: Full Name */}
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                      Full Student Name
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Vikram Sharma"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}

                {/* Login roll username or signup email */}
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    {authMode === 'login' ? 'Student Roll Number (Username)' : 'Campus Email Address'}
                  </label>
                  <div className="relative">
                    <input
                      type={authMode === 'login' ? 'text' : 'email'}
                      required
                      value={authMode === 'login' ? username : email}
                      onChange={(e) => authMode === 'login' ? setUsername(e.target.value.toUpperCase()) : setEmail(e.target.value)}
                      placeholder={authMode === 'login' ? '24BME055 or 23AID001' : 'name@campus.edu'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  {/* Quick Domain Pill Suggestions */}
                  {authMode === 'login' && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-slate-400">Role detected: {isBuyer ? 'Buyer' : 'Seller'}</span>
                    </div>
                  )}
                </div>

                {/* SIGN UP ONLY: Roll Number & Department Grid */}
                {authMode === 'signup' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Student Roll Number
                      </label>
                      <input
                        type="text"
                        required
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        placeholder="e.g. 24BME055"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Department
                      </label>
                      <select
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Computer Science & Eng">Computer Science & Eng</option>
                        <option value="Mechanical Engineering">Mechanical Engineering</option>
                        <option value="Electrical Engineering">Electrical Engineering</option>
                        <option value="Electronics & Comm">Electronics & Comm</option>
                        <option value="Civil Engineering">Civil Engineering</option>
                        <option value="Applied Sciences">Applied Sciences</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* SIGN UP ONLY: Hostel & Room Grid */}
                {authMode === 'signup' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Hostel Block
                      </label>
                      <select
                        value={hostel}
                        onChange={(e) => setHostel(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Block A (Gargi Hall)">Block A (Gargi Hall)</option>
                        <option value="Block B (Vishweshwarya)">Block B (Vishweshwarya)</option>
                        <option value="Block C (Aryabhatta)">Block C (Aryabhatta)</option>
                        <option value="Block D (Kalpana Chawla)">Block D (Kalpana Chawla)</option>
                        <option value="Day Scholar / Off-Campus">Day Scholar / Off-Campus</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                        Room No. & Phone
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          placeholder="Room 101"
                          className="w-1/3 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="relative flex-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Mobile No."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-2 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                      Password
                    </label>
                    {authMode === 'signup' && <span className="text-[10px] text-slate-400">8+ characters, mixed case, number, and symbol</span>}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={authMode === 'signup' ? 8 : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-3 px-5 rounded-xl font-bold text-xs md:text-sm tracking-wide text-white transition-all shadow-xl flex items-center justify-center gap-2 ${
                      isBuyer
                        ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-indigo-600/30'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-600/30'
                    } disabled:opacity-50`}
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>
                          {authMode === 'login'
                            ? `Sign In as ${isBuyer ? 'Junior Buyer' : 'Senior Seller'}`
                            : `Register as ${isBuyer ? 'Junior Buyer' : 'Senior Seller'}`}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Bottom Help */}
            <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                MongoDB Atlas database cluster active
              </span>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-indigo-400 hover:underline font-semibold"
              >
                {authMode === 'login' ? 'Need an account? Sign up' : 'Already registered? Sign in'}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Modern Footer */}
      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        BidNest &bull; Campus Liquidation Platform &bull; MongoDB Atlas Authentication
      </footer>
    </div>
  );
};
