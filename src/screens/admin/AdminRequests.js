import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import RequestQueue from '../../components/staff/RequestQueue';
import { fetchDepartments, fetchStaff } from '../../services/staff';

export default function AdminRequests({ onOpenRequest }) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => {});
    fetchStaff().then(setStaff).catch(() => {});
  }, []);

  return (
    <RequestQueue
      user={user}
      scopes={[{ key: 'all', label: 'All departments' }, { key: 'unassigned', label: 'Unassigned' }, { key: 'mine', label: 'Assigned to me' }]}
      onOpen={onOpenRequest}
      departments={departments}
      staff={staff}
    />
  );
}
