import { ChangeDetectionStrategy, Component } from '@angular/core';
import { WomenDayBouquetComponent } from './components/women-day/women-day-bouquet/women-day-bouquet.component';
import { Thiep } from './models/thiep.model';

@Component({
  selector: 'app-root',
  imports: [WomenDayBouquetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  /** Demo invitation fed to the 20/10 bouquet card. id 'preview' keeps RSVP in demo mode. */
  protected readonly demo: Thiep = {
    id: 'preview',
    senderName: '',
    receiverName: 'Phương Anh',
    isShowConfirm: true,
    confirms: [
      { user: 'Minh Anh', letter: 'Chúc mừng ngày 20/10, luôn xinh đẹp nhé! 🌷', isConfirm: true, timestamp: '2026-10-18T10:00:00Z' },
      { user: 'Lan', letter: 'Gửi Phương Anh thật nhiều điều dễ thương 🌸', isConfirm: true, timestamp: '2026-10-18T12:30:00Z' }
    ],
    description: JSON.stringify({
      letter: [
        'Gửi Phương Anh,',
        '',
        'Nhân ngày 20/10, tớ chúc Phương Anh thật nhiều sức khỏe, lúc nào cũng xinh xắn, rạng rỡ và vui vẻ nhé.',
        '',
        'Mong những điều dễ thương nhất sẽ luôn đến với Phương Anh. Chạm vào bó hoa để xem điều bất ngờ nha.'
      ].join('\n'),
      rsvpQuestion: 'Cuối tuần này Phương Anh đi chơi mừng 20/10 cùng tớ nhé?',
      wishes: [
        'Chúc mừng ngày 20/10',
        'Luôn xinh đẹp và rạng rỡ',
        'Mãi dịu dàng và hạnh phúc',
        'Bình an trong từng khoảnh khắc',
        'Luôn được yêu thương thật nhiều',
        'Chúc Phương Anh ngày càng xinh đẹp',
        'Chúc Phương Anh luôn luôn vui vẻ'
      ]
    })
  };
}
