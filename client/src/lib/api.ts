const API_BASE = import.meta.env.VITE_API_URL || '';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at?: string;
  password?: string;
};

export type Developer = {
  id: string;
  developer_no: number;
  name: string;
  country: string;
  experience: string;
  whatsapp: string;
  emails: string[];
  linkedin: string;
  other: string;
};

export type InterviewOption = {
  id: string | null;
  label: string;
  colorIndex: number;
};

export type InterviewField = 'profile' | 'interviewee' | 'type' | 'method' | 'status' | 'result';

export type InterviewStep = {
  type: string;
  method: string;
  interviewer: string;
  date: string;
  status: string;
};

export type InterviewProcess = {
  id: string;
  profile: string;
  developer: string;
  company: string;
  position: string;
  steps: InterviewStep[];
  result: string;
  note: string;
};

export type InterviewOptions = Record<InterviewField, InterviewOption[]>;

export type Experience = {
  companyName: string;
  role: string;
  location: string;
  period: string;
};

export type Education = {
  universityName: string;
  degreeMajor: string;
  location: string;
  period: string;
};

export type Profile = {
  id: string;
  name: string;
  full_name: string;
  role_title: string | null;
  contact_location: string;
  contact_phone: string;
  contact_email: string;
  contact_linkedin: string;
  experiences: Experience[];
  education: Education[];
  prompt: string;
  output_path: string;
  resume_format_id: string | null;
  /** static: company, role, location from the profile. dynamic: from resume content. */
  resume_structure?: 'static' | 'dynamic';
  contactLine?: string;
  assignees?: string[];
  resumeFormatName?: string;
  applicationCount?: number;
  promptReady?: boolean;
};

export type ResumeFormat = {
  id: string;
  name: string;
  filename: string;
  source?: 'project' | 'upload' | string;
  created_at: string;
};

export type ResumeBuild = {
  id: string;
  profile_id: string | null;
  job_link: string | null;
  company: string;
  role_title: string;
  salary?: string;
  description: string;
  resume_content: string;
  output_dir: string | null;
  pdf_path: string | null;
  doc_path: string | null;
  jd_path: string | null;
  status: string;
  unique_number: number | null;
  created_at: string;
};

export type Analytics = {
  totalProfiles: number;
  totalUsers: number;
  assignmentsByUser: {
    userId: string;
    userName: string;
    userEmail: string;
    profiles: string[];
  }[];
  applicationTracks: {
    days: string[];
    series: {
      profileId: string;
      profileName: string;
      values: number[];
    }[];
  };
};

function getToken() {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || res.statusText || 'Request failed');
  }
  return data as T;
}

export const SELECTED_PROFILE_KEY = 'selectedProfileId';

export const api = {
  register: (body: { email: string; password: string; name: string }) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  google: (credential: string) =>
    request<{ token: string; user: User }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),
  me: () => request<{ user: User }>('/api/auth/me'),

  getAssignedProfiles: () =>
    request<{ profiles: Profile[] }>('/api/profile/assigned'),
  getProfile: (id: string) => request<{ profile: Profile }>(`/api/profile/${id}`),
  listProfiles: () => request<{ profiles: Profile[] }>('/api/profile'),
  createProfile: (body: Record<string, unknown>) =>
    request<{ profile: Profile }>('/api/profile', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateProfile: (id: string, body: Record<string, unknown>) =>
    request<{ profile: Profile }>(`/api/profile/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteProfile: (id: string) =>
    request<{ ok: boolean }>(`/api/profile/${id}`, { method: 'DELETE' }),

  getFormats: () => request<{ formats: ResumeFormat[] }>('/api/formats'),
  uploadFormat: (file: File, name: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', name);
    return request<{ format: ResumeFormat }>('/api/formats', {
      method: 'POST',
      body: fd,
    });
  },

  getJobLinks: () => request<{ links: string }>('/api/job-links'),
  saveJobLinks: (links: string) =>
    request<{ links: string }>('/api/job-links', {
      method: 'PUT',
      body: JSON.stringify({ links }),
    }),
  getBuilds: (q?: string, profileId?: string) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set('q', q.trim());
    if (profileId?.trim()) params.set('profileId', profileId.trim());
    const qs = params.toString();
    return request<{ builds: ResumeBuild[] }>(`/api/builds${qs ? `?${qs}` : ''}`);
  },
  deleteBuild: (id: string) =>
    request<{ ok: boolean }>(`/api/builds/${id}`, { method: 'DELETE' }),
  /** Authenticated PDF blob for inline preview */
  getBuildPdfBlob: async (id: string) => {
    const headers = new Headers();
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const res = await fetch(`${API_BASE}/api/builds/${id}/pdf`, { headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { error?: string }).error || 'Failed to load PDF');
    }
    return res.blob();
  },
  parseLinks: (links: string) =>
    request<{ links: string[] }>('/api/builds/parse-links', {
      method: 'POST',
      body: JSON.stringify({ links }),
    }),
  checkCompany: (company: string, role: string, profileId: string) => {
    const id = profileId.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return Promise.resolve({
        similarCompanies: [] as string[],
        alreadyApplied: false,
      });
    }
    return request<{
      similarCompanies: string[];
      alreadyApplied: boolean;
    }>(
      `/api/builds/check-company?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&profileId=${encodeURIComponent(id)}`
    );
  },
  generateBuild: (body: Record<string, unknown>) =>
    request<{ build: ResumeBuild; paths: Record<string, string> }>('/api/builds/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  promptBundle: (
    company: string,
    role: string,
    description: string,
    profileId: string,
    salary = ''
  ) =>
    request<{ prompt: string; jd: string; bundled: string }>(
      `/api/builds/prompt-bundle?company=${encodeURIComponent(company)}&role=${encodeURIComponent(role)}&description=${encodeURIComponent(description)}&profileId=${encodeURIComponent(profileId)}&salary=${encodeURIComponent(salary)}`
    ),

  adminUsers: () => request<{ users: User[] }>('/api/admin/users'),
  adminCreateUser: (body: Record<string, unknown>) =>
    request<{ user: User }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminUpdateUser: (id: string, body: Record<string, unknown>) =>
    request<{ user: User }>(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminDeleteUser: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  adminUserProfiles: (id: string) =>
    request<{ profiles: { id: string; name: string; full_name: string }[] }>(
      `/api/admin/users/${id}/profiles`
    ),
  adminSetUserProfiles: (id: string, profileIds: string[]) =>
    request<{ profiles: { id: string; name: string; full_name: string }[] }>(
      `/api/admin/users/${id}/profiles`,
      { method: 'PUT', body: JSON.stringify({ profileIds }) }
    ),
  adminAnalytics: () => request<Analytics>('/api/admin/analytics'),

  adminDevelopers: () => request<{ developers: Developer[] }>('/api/admin/developers'),
  adminCreateDeveloper: (body: Record<string, unknown>) =>
    request<{ developer: Developer }>('/api/admin/developers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminUpdateDeveloper: (id: string, body: Record<string, unknown>) =>
    request<{ developer: Developer }>(`/api/admin/developers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminDeleteDeveloper: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/developers/${id}`, { method: 'DELETE' }),

  adminInterviews: () =>
    request<{ processes: InterviewProcess[]; options: InterviewOptions }>('/api/admin/interviews'),
  adminCreateInterview: (body: Record<string, unknown>) =>
    request<{ process: InterviewProcess }>('/api/admin/interviews', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminUpdateInterview: (id: string, body: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/api/admin/interviews/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  adminDeleteInterview: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/interviews/${id}`, { method: 'DELETE' }),
  adminCreateInterviewOption: (body: { field: InterviewField; label: string }) =>
    request<{ option: InterviewOption }>('/api/admin/interviews/options', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminRemoveInterviewOption: (field: InterviewField, label: string) =>
    request<{ ok: boolean }>('/api/admin/interviews/options/remove', {
      method: 'POST',
      body: JSON.stringify({ field, label }),
    }),
};
