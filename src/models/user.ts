export type User = {
	id: number;
	email: string;
};

export type UserWithPassword = User & {
	password_hash: string;
};
