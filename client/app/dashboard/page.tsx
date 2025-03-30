"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/use-auth';

export default function Dashboard() {
    const { isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading) {
            router.push('/evaluations');
        }
    }, [isLoading, router]);

    return null; // This component will not render anything, just redirect
} 