import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface User {
    id: string;
    username: string;
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for token in localStorage on initial load
        const token = localStorage.getItem('auth_token');
        if (token) {
            fetch('/api/v1/users/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error('Failed to validate token');
                })
                .then(userData => {
                    setUser(userData);
                })
                .catch(() => {
                    localStorage.removeItem('auth_token');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            // Create form data with username and password
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch('/api/v1/token', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('auth_token', data.access_token);

            // Fetch user data
            const userResponse = await fetch('/api/v1/users/me', {
                headers: {
                    'Authorization': `Bearer ${data.access_token}`
                }
            });

            if (!userResponse.ok) {
                throw new Error('Failed to fetch user data');
            }

            const userData = await userResponse.json();
            setUser(userData);
            toast.success('Logged in successfully');
        } catch (error: any) {
            toast.error(error.message || 'Authentication failed. Please check your credentials.');
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (username: string, email: string, password: string) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/v1/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            toast.success('Registration successful! You can now log in.');
            return data;
        } catch (error: any) {
            toast.error(error.message || 'Registration failed. Please try again.');
            console.error('Registration error:', error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('auth_token');
        setUser(null);
        toast.info('Logged out');
    };

    return {
        user,
        isLoading,
        login,
        logout,
        register,
        isAuthenticated: !!user
    };
} 