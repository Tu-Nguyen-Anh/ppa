Nhạc nền cho thiệp 20/10.

Đặt file nhạc của bạn vào đây với đúng tên:

    women-day-bg.mp3

Nó được tham chiếu trong women-day-bouquet.component.html:
    <audio #bgAudio src="/audio/women-day-bg.mp3" loop ...>

Nhạc sẽ tự phát (lặp lại) ngay khi người dùng chạm vào bó hoa lần đầu
(trình duyệt chặn tự phát nhạc trước khi có tương tác), và có nút bật/tắt
ở góc trên bên phải. Âm lượng mặc định 0.5 — chỉnh trong applyMusic()
của women-day-bouquet.component.ts nếu muốn.

Muốn đổi tên file khác thì sửa thuộc tính src của thẻ <audio> cho khớp.
