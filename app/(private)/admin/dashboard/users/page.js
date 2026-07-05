/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import apiClient from "@/libs/api";
import { useState, useEffect } from "react";
import LoadingCircle from "@/components/common/LoadingCircle";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/common/Pagination";
import PageSizeSelect from "@/components/common/PageSizeSelect";

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: parseInt(searchParams.get("page")) || 1,
    totalPages: 1,
    total: 0,
  });

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const page = searchParams.get("page") || 1;
      const limit = searchParams.get("limit") || 10;

      const response = await apiClient.get(
        `/admin/users?page=${page}&limit=${limit}`
      );
      console.log("API Response:", response);

      setUsers(response.data || []);
      setPagination({
        page: parseInt(page),
        totalPages: response.pagination.totalPages,
        total: response.pagination.total,
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      if (error.response?.status === 401) {
        router.push("/auth/signin");
      }
      setError(error.response?.data?.error || "Error loading users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  function handlePageChange(newPage) {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      const params = new URLSearchParams(searchParams);
      params.set("page", newPage);
      router.push(`/admin/dashboard/users?${params.toString()}`);
    }
  }

  function handlePageSizeChange(newLimit) {
    const params = new URLSearchParams(searchParams);
    params.set("limit", newLimit);
    params.set("page", "1"); // Reset to first page when changing limit
    router.push(`/admin/dashboard/users?${params.toString()}`);
  }

  const formatDate = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center pb-4">
              <div>
                <h1 className="text-3xl font-bold">User Management 👥</h1>
                <p className="text-gray-600">
                  View and manage all registered users
                </p>
              </div>
              <div className="flex gap-4">
                {/* Page Size Selector */}
                <PageSizeSelect
                  value={searchParams.get("limit") || "10"}
                  onChange={handlePageSizeChange}
                />
                <Link
                  href="/admin/dashboard/users/new"
                  className="btn btn-primary"
                >
                  Add User
                </Link>
              </div>
            </div>

            {error && (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <LoadingCircle />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Registration Date</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-4">
                          No registered users
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user._id}>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            <span className="badge badge-ghost">
                              {user.role || "user"}
                            </span>
                          </td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>{formatDate(user.lastLogin)}</td>
                          <td>
                            <Link
                              href={`/admin/dashboard/users/edit/${user._id}`}
                              className="btn btn-sm btn-ghost"
                            >
                              Edit
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                <Pagination
                  paginationData={{
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                  }}
                  setPage={handlePageChange}
                />
              </div>
            )}

            {/* Total Users Count */}
            <div className="mt-4 text-sm text-gray-600">
              Total users: {pagination.total}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
