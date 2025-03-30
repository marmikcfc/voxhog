"use client";

import { useEffect } from 'react';
import { RegisterForm } from '@/components/auth/register-form';
import { useAuth } from '@/lib/hooks/use-auth';
import { useRouter } from 'next/navigation';

export default function Register() {
    const { register, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/evaluations');
        }
    }, [isAuthenticated, router]);

    const handleRegister = async (username: string, email: string, password: string) => {
        try {
            await register(username, email, password);
            router.push('/evaluations');
        } catch (error) {
            console.error('Registration failed:', error);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-bold">VoxHog</h1>
                    <p className="mt-2 text-gray-500">Voice Agent Testing Platform</p>
                </div>
                <div className="rounded-lg border bg-white p-6 shadow-md dark:bg-gray-950">
                    <RegisterForm onRegister={handleRegister} isLoading={isLoading} />
                </div>
            </div>
        </div>
    );
} 