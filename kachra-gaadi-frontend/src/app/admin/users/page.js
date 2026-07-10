/* eslint-disable */
"use client";

import { useState, useEffect } from "react";
import api from "../../../utils/axios";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState(null);
  const [form, setForm] = useState({ email: "", password: "", role: "supervisor" });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showMessage = (msg, isError = false) => {
    setMessage({ text: msg, isError });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/users', form);
      if (res.data.success) {
        showMessage("User created successfully!");
        setForm({ email: "", password: "", role: "supervisor" });
        fetchUsers();
      }
    } catch (err) {
      showMessage(err.response?.data?.message || "Error creating user", true);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      const res = await api.delete(`/api/users/${id}`);
      if (res.data.success) {
        showMessage("User deleted");
        fetchUsers();
      }
    } catch (err) {
      showMessage(err.response?.data?.message || "Error deleting user", true);
    }
  };

  const updateRole = async (id, newRole) => {
    try {
      const res = await api.put(`/api/users/${id}`, { role: newRole });
      if (res.data.success) {
        showMessage("Role updated");
        fetchUsers();
      }
    } catch (err) {
      showMessage(err.response?.data?.message || "Error updating role", true);
    }
  };

  return (
    <>
      <header className="h-20 bg-white border-b border-gray-200 flex items-center px-8 z-10 shadow-sm shrink-0">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
      </header>

      {message && (
        <div className={`absolute top-24 right-8 z-50 px-6 py-3 rounded-xl shadow-lg border text-sm font-bold flex items-center transform transition-all duration-300 ${
          message.isError ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
        }`}>
          <span className={`w-2 h-2 rounded-full mr-3 ${message.isError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
          {message.text}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-fit">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Add New User</h3>
            <form onSubmit={handleSave} className="space-y-4">
              <input required type="email" placeholder="Email Address" className="w-full border rounded-xl p-3"
                value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <input required type="password" placeholder="Password" className="w-full border rounded-xl p-3"
                value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              <select className="w-full border rounded-xl p-3 bg-white" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="supervisor">Supervisor</option>
              </select>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors">Create User</button>
            </form>
          </div>
          
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-500 uppercase tracking-wider">Created At</th>
                  <th className="px-6 py-4 text-center font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{u.email}</td>
                    <td className="px-6 py-4">
                      <select 
                        className={`text-xs font-bold rounded px-2 py-1 border-none focus:ring-0 ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                      >
                        <option value="admin">ADMIN</option>
                        <option value="supervisor">SUPERVISOR</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => handleDelete(u.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan="4" className="text-center py-8 text-gray-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>
    </>
  );
}
