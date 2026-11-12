export type Award = {
	id: string;
	name: string;
	created_at: number;
};

export type Category = {
	id: string;
	name: string;
	created_at: number;
};

export type Nominee = {
	id: string;
	name: string;
	created_at: number;
};

export type Video = {
	id: string;
	mime_type: "video/mp4" | "video/webm";
	size_bytes: number;
	created_at: number;
};

export type AwardManagement = Award & {
	categories: (Category & {
		nominees: (Nominee & { videos: Video[] })[];
	})[];
};
