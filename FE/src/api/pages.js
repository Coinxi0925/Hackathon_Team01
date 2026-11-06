import client from "./client";

export async function getDocumentPages(documentId) {
  try {
    const res = await client.get(`/documents/${documentId}/pages`);
    return res.data;
  } catch (error) {
    console.error(
      "문서 페이지 조회 실패:",
      error.response?.data || error
    );

    throw new Error(
      error.response?.data?.detail ||
      error.response?.data?.message ||
      "문서 페이지를 불러오지 못했습니다."
    );
  }
}