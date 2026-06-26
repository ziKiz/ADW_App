import { useState } from 'react';

interface Contact {
  id: number;
  name: string;
  title: string;
  phone: string;
  email: string;
  department: string;
}

interface ContactCategory {
  category: string;
  icon: string;
  contacts: Contact[];
}

function Contacts() {
  const [selectedCategory, setSelectedCategory] = useState(0);

  const contactCategories: ContactCategory[] = [
    {
      category: 'Vedení společnosti',
      icon: '👔',
      contacts: [
        {
          id: 1,
          name: 'Demo Ředitel',
          title: 'Ředitel společnosti',
          phone: '+420 603 123 456',
          email: 'demo.reditel@example.local',
          department: 'Ředitelství'
        },
        {
          id: 2,
          name: 'Demo Vedoucí RV',
          title: 'Vedoucí Rostlinné výroby',
          phone: '+420 604 234 567',
          email: 'demo.vedouci.rv@example.local',
          department: 'Rostlinná výroba'
        }
      ]
    },
    {
      category: 'Služby',
      icon: '🔧',
      contacts: [
        {
          id: 3,
          name: 'Servisní tým',
          title: 'Technická podpora',
          phone: '+420 605 345 678',
          email: 'support@example.local',
          department: 'IT'
        },
        {
          id: 4,
          name: 'Údržba majetku',
          title: 'Údržba a opravy',
          phone: '+420 606 456 789',
          email: 'maintenance@example.local',
          department: 'Mechanizace'
        }
      ]
    },
    {
      category: 'Nejčastější čísla',
      icon: '☎️',
      contacts: [
        {
          id: 5,
          name: 'Ústředna',
          title: 'Hlavní přepážka',
          phone: '+420 562 123 456',
          email: 'info@example.local',
          department: 'Recepce'
        },
        {
          id: 6,
          name: 'Nouzové služby',
          title: 'Pohotovostní služba',
          phone: '+420 602 789 012',
          email: '',
          department: 'Dispečink'
        }
      ]
    }
  ];

  return (
    <div className="container">
      <div className="card">
        <div className="page-heading">
          <div>
            <p className="eyebrow">Kontakty</p>
            <h1 className="page-title">Důležité kontakty</h1>
          </div>
        </div>

        <div className="contacts-layout">
          <aside className="contacts-sidebar">
            <nav className="contacts-nav">
              {contactCategories.map((category, index) => (
                <button
                  key={category.category}
                  className={`contact-category-btn ${selectedCategory === index ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(index)}
                >
                  <span className="category-icon">{category.icon}</span>
                  <span>{category.category}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="contacts-main">
            <div className="contacts-group">
              <h2>{contactCategories[selectedCategory].category}</h2>
              <div className="contacts-list">
                {contactCategories[selectedCategory].contacts.map((contact) => (
                  <div key={contact.id} className="contact-card">
                    <div className="contact-header">
                      <strong>{contact.name}</strong>
                      <span className="contact-title">{contact.title}</span>
                    </div>
                    <div className="contact-details">
                      <div className="contact-item">
                        <span className="label">Telefon:</span>
                        <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                      </div>
                      {contact.email && (
                        <div className="contact-item">
                          <span className="label">Email:</span>
                          <a href={`mailto:${contact.email}`}>{contact.email}</a>
                        </div>
                      )}
                      <div className="contact-item">
                        <span className="label">Oddělení:</span>
                        <span>{contact.department}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default Contacts;
